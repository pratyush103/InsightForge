from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from backend.agents.graph import run_analysis_pipeline, stream_analysis_pipeline
from backend.agents.layout_engine import (
    build_echarts_option,
    build_kpi_payload,
    compute_responsive_grid_layout,
    infer_columns,
)
from backend.connectors.base import ConnectorCreateRequest
from backend.connectors.sql_connector import connector_registry
from backend.llm.ollama_manager import ollama_manager
from backend.pipeline.manifest import (
    DashboardWidgetSpec,
    compute_rows_sha256,
    enrich_dataset_statistics,
    generate_reproducible_python_script,
    pipeline_store,
)

app = FastAPI(
    title="InsightForge API",
    description="Multi-Agent AI BI Dashboard Generator (LangGraph + Ollama + SQLite/MySQL/MS SQL + Apache ECharts)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    query: str
    connector_id: str = "default_sqlite_commerce"
    model_name: str | None = None
    layout_preset: str = "executive"


class SelectModelRequest(BaseModel):
    model_name: str


class PullModelRequest(BaseModel):
    model_name: str


class SQLQueryRequest(BaseModel):
    sql: str
    max_rows: int = 1000


class WidgetMutateRequest(BaseModel):
    connector_id: str = "default_sqlite_commerce"
    widget: DashboardWidgetSpec
    new_chart_type: str | None = None
    new_sql_query: str | None = None
    new_title: str | None = None


class LayoutPresetRequest(BaseModel):
    widgets: list[DashboardWidgetSpec]
    preset: str = "executive"


@app.get("/api/health")
async def health_check():
    ollama_status = await ollama_manager.get_status()
    connectors = connector_registry.list_connectors()
    return {
        "status": "ok",
        "service": "InsightForge Multi-Agent BI Backend",
        "ollama_status": ollama_status.status,
        "selected_model": ollama_status.selected_model,
        "connector_count": len(connectors),
    }


# ============================================================================
# OLLAMA DETECTION, LIFECYCLE & MODEL HUB ENDPOINTS
# ============================================================================


@app.get("/api/ollama/status")
async def get_ollama_status():
    return await ollama_manager.get_status()


@app.post("/api/ollama/start")
async def start_ollama_daemon():
    return await ollama_manager.start_server()


@app.post("/api/ollama/select")
async def select_ollama_model(req: SelectModelRequest):
    ollama_manager.set_selected_model(req.model_name)
    return await ollama_manager.get_status()


@app.post("/api/ollama/pull")
async def pull_ollama_model(req: PullModelRequest):
    return StreamingResponse(
        ollama_manager.pull_model_stream(req.model_name),
        media_type="text/event-stream",
    )


# ============================================================================
# SQL CONNECTORS (SQLite, MySQL, MS SQL Server)
# ============================================================================


@app.get("/api/connectors")
async def list_connectors():
    return {"connectors": connector_registry.list_connectors()}


@app.post("/api/connectors")
async def create_connector(req: ConnectorCreateRequest):
    try:
        info = connector_registry.register_connector(req)
        return info
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    removed = connector_registry.remove_connector(connector_id)
    if not removed:
        raise HTTPException(status_code=400, detail="Cannot remove built-in or non-existent connector.")
    return {"removed": True, "connector_id": connector_id}


@app.get("/api/connectors/{connector_id}/schema")
async def get_connector_schema(connector_id: str, refresh: bool = False):
    conn = connector_registry.get_connector(connector_id)
    return conn.get_schema_catalog(force_refresh=refresh)


@app.post("/api/connectors/{connector_id}/query")
async def run_safe_sql_query(connector_id: str, req: SQLQueryRequest):
    conn = connector_registry.get_connector(connector_id)
    return conn.execute_safe_query(req.sql, max_rows=req.max_rows)


@app.post("/api/connectors/{connector_id}/upload-csv")
async def upload_csv_to_sqlite(
    connector_id: str,
    table_name: str = Form(...),
    file: UploadFile = File(...),
):
    conn = connector_registry.get_connector(connector_id)
    try:
        raw_bytes = await file.read()
        tbl_profile = conn.import_csv_table(table_name, raw_bytes)
        return {
            "status": "imported",
            "table": tbl_profile,
            "catalog": conn.get_schema_catalog(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ============================================================================
# MULTI-AGENT LANGGRAPH BI PIPELINE & STREAMING
# ============================================================================


@app.post("/api/analyze")
async def analyze_prompt(req: AnalyzeRequest):
    final_state = await run_analysis_pipeline(
        user_query=req.query,
        connector_id=req.connector_id,
        model_name=req.model_name,
        layout_preset=req.layout_preset,
    )
    manifest = final_state.get("pipeline_manifest")
    return {
        "manifest": manifest,
        "traces": final_state.get("agent_traces", []),
    }


@app.post("/api/analyze/stream")
async def analyze_prompt_stream(req: AnalyzeRequest):
    return StreamingResponse(
        stream_analysis_pipeline(
            user_query=req.query,
            connector_id=req.connector_id,
            model_name=req.model_name,
            layout_preset=req.layout_preset,
        ),
        media_type="text/event-stream",
    )


@app.post("/api/widget/mutate")
async def mutate_single_widget(req: WidgetMutateRequest):
    conn = connector_registry.get_connector(req.connector_id)
    w = req.widget.model_copy(deep=True)

    if req.new_title:
        w.title = req.new_title

    if req.new_sql_query and req.new_sql_query.strip() != w.sql_query.strip():
        res = conn.execute_safe_query(req.new_sql_query)
        if not res.success:
            raise HTTPException(status_code=400, detail=res.error or "SQL query failed.")
        w.sql_query = res.executed_sql
        w.columns = res.columns
        x_col, y_cols = infer_columns(res.rows)
        w.x_field = x_col
        w.y_fields = y_cols
        enriched_rows, stats, anomalies = enrich_dataset_statistics(res.rows, x_col, y_cols)
        w.rows = enriched_rows
        w.data_hash = compute_rows_sha256(res.rows)
        w.anomalies = anomalies
    else:
        _, stats, _ = enrich_dataset_statistics(w.rows, w.x_field, w.y_fields)

    if req.new_chart_type:
        c_type = req.new_chart_type
        w.chart_type = c_type  # type: ignore[assignment]
        if c_type == "kpi":
            w.widget_type = "kpi"
        elif c_type == "table":
            w.widget_type = "table"
        else:
            w.widget_type = "echarts"

    if w.widget_type == "kpi":
        w.kpi_payload = build_kpi_payload(w.title, w.rows, w.x_field, w.y_fields, stats)
    elif w.widget_type == "echarts":
        w.echarts_option = build_echarts_option(
            w.chart_type, w.title, w.rows, w.x_field, w.y_fields, w.series_field
        )

    return {"widget": w}


@app.post("/api/layout/recompute")
async def recompute_layout(req: LayoutPresetRequest):
    layouts = compute_responsive_grid_layout(req.widgets, preset=req.preset)
    return {"layouts": layouts}


# ============================================================================
# REPRODUCIBLE PIPELINES & LINEAGE REPLAY
# ============================================================================


@app.get("/api/pipelines")
async def list_saved_pipelines():
    return {"pipelines": pipeline_store.list_manifests()}


@app.get("/api/pipelines/{pipeline_id}")
async def get_saved_pipeline(pipeline_id: str):
    manifest = pipeline_store.get(pipeline_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Pipeline manifest not found.")
    return manifest


@app.post("/api/pipelines/{pipeline_id}/replay")
async def replay_saved_pipeline(pipeline_id: str):
    try:
        manifest = pipeline_store.replay(pipeline_id)
        return manifest
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/pipelines/{pipeline_id}/export/python")
async def export_pipeline_python(pipeline_id: str):
    manifest = pipeline_store.get(pipeline_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Pipeline manifest not found.")
    code = generate_reproducible_python_script(manifest)
    return PlainTextResponse(content=code, media_type="text/x-python")
