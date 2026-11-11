from __future__ import annotations

import asyncio
import pytest

from backend.agents.graph import run_analysis_pipeline
from backend.connectors.sql_connector import connector_registry
from backend.connectors.sql_guard import SQLValidationError, validate_and_transpile_sql
from backend.llm.ollama_manager import ollama_manager
from backend.pipeline.manifest import pipeline_store


def test_sql_guard_dialects_and_readonly():
    # 1. SQLite SELECT with auto LIMIT
    sqlite_sql = validate_and_transpile_sql("SELECT region, SUM(net_revenue) FROM orders GROUP BY region", "sqlite", max_rows=500)
    assert "SELECT" in sqlite_sql.upper()
    assert "LIMIT 500" in sqlite_sql.upper()

    # 2. MySQL SELECT
    mysql_sql = validate_and_transpile_sql("SELECT region, COUNT(*) AS cnt FROM orders GROUP BY region", "mysql", max_rows=100)
    assert "LIMIT 100" in mysql_sql.upper()

    # 3. MS SQL Server (T-SQL) transpiles LIMIT -> TOP
    mssql_sql = validate_and_transpile_sql("SELECT region, SUM(net_revenue) AS rev FROM orders GROUP BY region", "mssql", max_rows=250)
    assert "TOP 250" in mssql_sql.upper()

    # 4. Reject DDL / DML statements
    for bad_query in [
        "DROP TABLE orders",
        "DELETE FROM customers WHERE customer_id = 1",
        "UPDATE subscriptions SET mrr_usd = 0",
        "INSERT INTO products VALUES (99, 'Hack', 'Cat', 'Pro', 10, 0.5)",
        "SELECT * FROM orders; DROP TABLE orders",
    ]:
        with pytest.raises(SQLValidationError):
            validate_and_transpile_sql(bad_query, "sqlite")


def test_default_sqlite_connector_and_schema():
    conn = connector_registry.get_connector("default_sqlite_commerce")
    catalog = conn.get_schema_catalog()
    assert catalog.dialect == "sqlite"
    table_names = {t.table_name for t in catalog.tables}
    assert {"customers", "products", "subscriptions", "orders", "marketing_campaigns", "support_tickets"}.issubset(table_names)

    res = conn.execute_safe_query("SELECT region, ROUND(SUM(net_revenue), 2) AS rev FROM orders GROUP BY region ORDER BY rev DESC")
    assert res.success is True
    assert res.row_count == 4
    assert "region" in res.columns


def test_ollama_manager_detection():
    status = asyncio.run(ollama_manager.get_status())
    assert status.status in ("running", "installed_stopped", "not_installed")
    assert len(status.recommended_models) >= 5
    top_tags = [m.tag for m in status.recommended_models]
    assert "qwen2.5-coder:7b" in top_tags


def test_langgraph_multi_agent_pipeline_and_replay():
    final_state = asyncio.run(
        run_analysis_pipeline(
            user_query="Analyze SaaS churn, ARR exposure, and subscription retention by segment",
            connector_id="default_sqlite_commerce",
            layout_preset="executive",
        )
    )
    manifest = final_state.get("pipeline_manifest")
    assert manifest is not None
    assert len(manifest.widgets) >= 6
    assert len(manifest.steps) >= 6
    assert "lg" in manifest.layouts

    # Verify deterministic zero-LLM pipeline replay
    replayed = pipeline_store.replay(manifest.pipeline_id)
    assert replayed.reproducibility_verified is True
    assert replayed.data_drifted is False


def test_geo_map_generation_and_kpi_formatting():
    final_state = asyncio.run(
        run_analysis_pipeline(
            user_query="Analyse top performing marketing channels by regions (plot on map)",
            connector_id="default_sqlite_commerce",
            layout_preset="executive",
        )
    )
    manifest = final_state.get("pipeline_manifest")
    assert manifest is not None
    geo_widgets = [w for w in manifest.widgets if w.chart_type == "geo_map"]
    assert len(geo_widgets) >= 1
    geo_opt = geo_widgets[0].echarts_option
    assert geo_opt is not None
    assert geo_opt.get("geo", {}).get("map") == "world"
    series_types = [s.get("type") for s in geo_opt.get("series", [])]
    assert "map" in series_types
    assert "effectScatter" in series_types

    # Ensure leads_generated and conversions KPIs do not have erroneous '%' suffix
    for w in manifest.widgets:
        if w.widget_type == "kpi" and w.kpi_payload and w.id in ("widget_kpi_total_leads", "widget_kpi_conversions"):
            assert not str(w.kpi_payload.get("formatted_value", "")).endswith("%")

