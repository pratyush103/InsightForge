from __future__ import annotations

from typing import Any, Literal, TypedDict

from backend.connectors.base import QueryExecutionResult, SchemaCatalog, SQLDialectType
from backend.pipeline.manifest import DashboardWidgetSpec, GridCoordinates, PipelineManifest, PipelineStep


class AnalyticalTask(TypedDict, total=False):
    task_id: str
    title: str
    subtitle: str
    widget_type: Literal["kpi", "echarts", "table"]
    chart_type: str
    sql_query: str
    x_field: str | None
    y_fields: list[str]
    rationale: str


class AgentTraceEvent(TypedDict):
    agent: str
    status: Literal["running", "completed", "warning", "error"]
    title: str
    detail: str
    duration_ms: float


class InsightForgeState(TypedDict, total=False):
    user_query: str
    connector_id: str
    model_name: str | None
    layout_preset: str
    # Node 1: Schema Profiler
    schema_catalog: SchemaCatalog
    dialect: SQLDialectType
    schema_prompt: str
    # Node 2: BI Planner
    dashboard_title: str
    analysis_plan: list[AnalyticalTask]
    # Node 3: SQL Coder & Self-Healing Loop
    executed_results: dict[str, QueryExecutionResult]
    sql_retry_count: int
    failed_task_ids: list[str]
    # Node 4: Reproducible Pipeline Builder
    pipeline_steps: list[PipelineStep]
    enriched_datasets: dict[str, dict[str, Any]]
    # Node 5: Visualization & Auto-Layout Architect
    widgets: list[DashboardWidgetSpec]
    layouts: dict[str, list[GridCoordinates]]
    # Node 6: Executive Insight Narrator
    executive_summary: str
    key_insights: list[str]
    suggested_followups: list[str]
    pipeline_manifest: PipelineManifest
    # Telemetry & Trace
    agent_traces: list[AgentTraceEvent]
    llm_mode: str
