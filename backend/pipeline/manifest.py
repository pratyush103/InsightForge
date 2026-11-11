from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from pydantic import BaseModel, Field

from backend.connectors.base import SQLDialectType
from backend.connectors.sql_connector import connector_registry


def compute_rows_sha256(rows: list[dict[str, Any]]) -> str:
    """Computes a canonical SHA-256 hash of a dataset for reproducible pipeline verification."""
    canonical = json.dumps(rows, sort_keys=True, default=str)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


class StatisticalAnomaly(BaseModel):
    row_index: int
    dimension_label: str
    metric_name: str
    value: float
    z_score: float
    direction: Literal["spike", "drop"]


class PipelineStep(BaseModel):
    step_id: str
    step_number: int
    title: str
    kind: Literal["sql_extraction", "statistical_enrichment"]
    sql_query: str | None = None
    executed_sql: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    operation: str = "select"
    row_count: int = 0
    columns: list[str] = Field(default_factory=list)
    output_hash: str = ""
    execution_ms: float = 0.0
    anomalies_detected: list[StatisticalAnomaly] = Field(default_factory=list)
    summary_stats: dict[str, Any] = Field(default_factory=dict)


class GridCoordinates(BaseModel):
    i: str
    x: int
    y: int
    w: int
    h: int
    minW: int = 3
    minH: int = 3


class DashboardWidgetSpec(BaseModel):
    id: str
    title: str
    subtitle: str = ""
    widget_type: Literal["kpi", "echarts", "table"]
    chart_type: Literal[
        "kpi",
        "area_spline",
        "multi_line",
        "grouped_bar",
        "stacked_bar",
        "horizontal_bar",
        "combo_dual_axis",
        "donut",
        "rose",
        "funnel",
        "radar",
        "scatter",
        "heatmap",
        "treemap",
        "sankey",
        "geo_map",
        "table",
    ]
    step_id: str
    sql_query: str
    data_hash: str
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    x_field: str | None = None
    y_fields: list[str] = Field(default_factory=list)
    series_field: str | None = None
    kpi_payload: dict[str, Any] | None = None
    echarts_option: dict[str, Any] | None = None
    insight_summary: str = ""
    anomalies: list[StatisticalAnomaly] = Field(default_factory=list)


class PipelineManifest(BaseModel):
    pipeline_id: str
    title: str
    user_query: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_replayed_at: str | None = None
    connector_id: str
    connector_name: str
    dialect: SQLDialectType
    schema_fingerprint: str
    model_used: str
    steps: list[PipelineStep] = Field(default_factory=list)
    widgets: list[DashboardWidgetSpec] = Field(default_factory=list)
    layouts: dict[str, list[GridCoordinates]] = Field(default_factory=dict)
    executive_summary: str = ""
    key_insights: list[str] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)
    reproducibility_verified: bool = True
    data_drifted: bool = False


def enrich_dataset_statistics(
    rows: list[dict[str, Any]],
    x_col: str | None,
    y_cols: list[str],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[StatisticalAnomaly]]:
    """
    Runs deterministic statistical enrichment on SQL output:
    - Computes min, max, mean, median, std, total, and first-to-last delta % for numeric columns
    - Computes 3-period moving average (`<col>_ma3`) and Z-score (`<col>_zscore`)
    - Flags statistical anomalies (`|z_score| >= 1.75`)
    """
    if not rows or not y_cols:
        return rows, {}, []

    primary_y = y_cols[0]
    numeric_vals: list[tuple[int, float]] = []
    for idx, r in enumerate(rows):
        v = r.get(primary_y)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and not math.isnan(float(v)):
            numeric_vals.append((idx, float(v)))

    if not numeric_vals:
        return rows, {}, []

    vals_only = [v for _, v in numeric_vals]
    n = len(vals_only)
    total = sum(vals_only)
    mean = total / n
    variance = sum((x - mean) ** 2 for x in vals_only) / max(1, n - 1) if n > 1 else 0.0
    std = math.sqrt(variance)
    sorted_vals = sorted(vals_only)
    median = sorted_vals[n // 2]

    first_val = vals_only[0]
    last_val = vals_only[-1]
    delta_pct = round(((last_val - first_val) / abs(first_val)) * 100.0, 2) if first_val != 0 else 0.0

    anomalies: list[StatisticalAnomaly] = []
    enriched_rows: list[dict[str, Any]] = []

    for idx, r in enumerate(rows):
        new_r = dict(r)
        raw_v = r.get(primary_y)
        if isinstance(raw_v, (int, float)) and not isinstance(raw_v, bool):
            fv = float(raw_v)
            # 3-point moving average
            window = [
                float(rows[j].get(primary_y))
                for j in range(max(0, idx - 2), idx + 1)
                if isinstance(rows[j].get(primary_y), (int, float))
            ]
            if window:
                new_r[f"{primary_y}_ma3"] = round(sum(window) / len(window), 2)
            if std > 1e-9 and n >= 4:
                z = round((fv - mean) / std, 2)
                new_r[f"{primary_y}_zscore"] = z
                if abs(z) >= 1.75:
                    dim_label = str(r.get(x_col, f"Row {idx + 1}")) if x_col else f"Row {idx + 1}"
                    anomalies.append(
                        StatisticalAnomaly(
                            row_index=idx,
                            dimension_label=dim_label,
                            metric_name=primary_y,
                            value=round(fv, 2),
                            z_score=z,
                            direction="spike" if z > 0 else "drop",
                        )
                    )
        enriched_rows.append(new_r)

    stats = {
        "metric": primary_y,
        "count": n,
        "sum": round(total, 2),
        "mean": round(mean, 2),
        "median": round(median, 2),
        "min": round(min(vals_only), 2),
        "max": round(max(vals_only), 2),
        "std": round(std, 2),
        "period_delta_pct": delta_pct,
        "anomaly_count": len(anomalies),
    }
    return enriched_rows, stats, anomalies


def generate_reproducible_python_script(manifest: PipelineManifest) -> str:
    """Exports the pipeline manifest as a standalone, reproducible Python + SQLAlchemy + Pandas script."""
    steps_code: list[str] = []
    for step in manifest.steps:
        if step.kind == "sql_extraction" and step.executed_sql:
            steps_code.append(
                f'''    # Step {step.step_number}: {step.title}
    # Expected SHA-256 Lineage Hash: {step.output_hash}
    sql_{step.step_id} = """{step.executed_sql}"""
    df_{step.step_id} = pd.read_sql(text(sql_{step.step_id}), conn)
    print(f"[{step.step_id}] Rows: {{len(df_{step.step_id})}} | Columns: {{list(df_{step.step_id}.columns)}}")
'''
            )

    steps_joined = "\n".join(steps_code)
    return f'''"""
InsightForge Reproducible Data Analysis Pipeline
================================================
Pipeline ID       : {manifest.pipeline_id}
Title             : {manifest.title}
User Prompt       : {manifest.user_query}
Dialect           : {manifest.dialect.upper()} ({manifest.connector_name})
Schema Fingerprint: {manifest.schema_fingerprint}
Generated At      : {manifest.created_at}
"""

import hashlib
import json
import pandas as pd
from sqlalchemy import create_engine, text

DATABASE_URL = "sqlite:///data/insightforge_commerce.db"  # Update URI for MySQL / MS SQL Server


def run_reproducible_pipeline() -> None:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
{steps_joined or "        pass"}


if __name__ == "__main__":
    run_reproducible_pipeline()
'''


class PipelineStore:
    """Persists and replays reproducible pipeline manifests on disk."""

    def __init__(self, storage_dir: Path | None = None) -> None:
        self.storage_dir = storage_dir or (Path(__file__).resolve().parent.parent.parent / "data" / "pipelines")
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, PipelineManifest] = {}
        self._load_existing()

    def _load_existing(self) -> None:
        for file_path in sorted(self.storage_dir.glob("*.json"), reverse=True):
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                manifest = PipelineManifest(**data)
                self._cache[manifest.pipeline_id] = manifest
            except Exception:
                continue

    def save(self, manifest: PipelineManifest) -> PipelineManifest:
        self._cache[manifest.pipeline_id] = manifest
        out_path = self.storage_dir / f"{manifest.pipeline_id}.json"
        out_path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
        return manifest

    def list_manifests(self) -> list[dict[str, Any]]:
        items = sorted(self._cache.values(), key=lambda m: m.created_at, reverse=True)
        return [
            {
                "pipeline_id": m.pipeline_id,
                "title": m.title,
                "user_query": m.user_query,
                "created_at": m.created_at,
                "last_replayed_at": m.last_replayed_at,
                "connector_id": m.connector_id,
                "connector_name": m.connector_name,
                "dialect": m.dialect,
                "schema_fingerprint": m.schema_fingerprint,
                "model_used": m.model_used,
                "widget_count": len(m.widgets),
                "step_count": len(m.steps),
                "reproducibility_verified": m.reproducibility_verified,
            }
            for m in items
        ]

    def get(self, pipeline_id: str) -> PipelineManifest | None:
        return self._cache.get(pipeline_id)

    def replay(self, pipeline_id: str) -> PipelineManifest:
        """
        Deterministically re-executes all SQL and statistical transformation steps in the manifest
        without invoking the LLM, verifying SHA-256 lineage hashes and refreshing widget datasets.
        """
        manifest = self._cache.get(pipeline_id)
        if not manifest:
            raise KeyError(f"Pipeline {pipeline_id} not found.")

        from backend.agents.layout_engine import build_echarts_option, build_kpi_payload

        conn = connector_registry.get_connector(manifest.connector_id)
        drifted = False
        step_outputs: dict[str, list[dict[str, Any]]] = {}

        for step in manifest.steps:
            if step.kind == "sql_extraction" and step.sql_query:
                res = conn.execute_safe_query(step.sql_query)
                if res.success:
                    new_hash = compute_rows_sha256(res.rows)
                    if step.output_hash and new_hash != step.output_hash:
                        drifted = True
                    step.output_hash = new_hash
                    step.row_count = res.row_count
                    step.execution_ms = res.execution_ms
                    step_outputs[step.step_id] = res.rows

        for widget in manifest.widgets:
            rows = step_outputs.get(widget.step_id, widget.rows)
            enriched_rows, stats, anomalies = enrich_dataset_statistics(
                rows, widget.x_field, widget.y_fields
            )
            widget.rows = enriched_rows
            widget.data_hash = compute_rows_sha256(rows)
            widget.anomalies = anomalies
            if widget.widget_type == "kpi":
                widget.kpi_payload = build_kpi_payload(
                    title=widget.title,
                    rows=enriched_rows,
                    x_field=widget.x_field,
                    y_fields=widget.y_fields,
                    stats=stats,
                )
            elif widget.widget_type == "echarts":
                widget.echarts_option = build_echarts_option(
                    chart_type=widget.chart_type,
                    title=widget.title,
                    rows=enriched_rows,
                    x_field=widget.x_field,
                    y_fields=widget.y_fields,
                    series_field=widget.series_field,
                )

        manifest.last_replayed_at = datetime.now(timezone.utc).isoformat()
        manifest.data_drifted = drifted
        manifest.reproducibility_verified = True
        return self.save(manifest)


pipeline_store = PipelineStore()
