from __future__ import annotations

import json
from typing import Any, AsyncGenerator

from langgraph.graph import END, START, StateGraph

from backend.agents.nodes import (
    bi_planner_node,
    insight_narrator_node,
    pipeline_builder_node,
    schema_profiler_node,
    should_retry_sql,
    sql_coder_node,
    viz_architect_node,
)
from backend.agents.state import InsightForgeState


def build_insightforge_graph():
    """Compiles the 6-agent LangGraph StateGraph with conditional SQL self-healing retry loop."""
    workflow = StateGraph(InsightForgeState)

    workflow.add_node("schema_profiler", schema_profiler_node)
    workflow.add_node("bi_planner", bi_planner_node)
    workflow.add_node("sql_coder", sql_coder_node)
    workflow.add_node("pipeline_builder", pipeline_builder_node)
    workflow.add_node("viz_architect", viz_architect_node)
    workflow.add_node("insight_narrator", insight_narrator_node)

    workflow.add_edge(START, "schema_profiler")
    workflow.add_edge("schema_profiler", "bi_planner")
    workflow.add_edge("bi_planner", "sql_coder")
    workflow.add_conditional_edges(
        "sql_coder",
        should_retry_sql,
        {
            "retry_sql": "sql_coder",
            "continue_pipeline": "pipeline_builder",
        },
    )
    workflow.add_edge("pipeline_builder", "viz_architect")
    workflow.add_edge("viz_architect", "insight_narrator")
    workflow.add_edge("insight_narrator", END)

    return workflow.compile()


insightforge_graph = build_insightforge_graph()


async def run_analysis_pipeline(
    user_query: str,
    connector_id: str = "default_sqlite_commerce",
    model_name: str | None = None,
    layout_preset: str = "executive",
) -> dict[str, Any]:
    """Executes the full multi-agent LangGraph pipeline and returns the final state."""
    initial_state: InsightForgeState = {
        "user_query": user_query,
        "connector_id": connector_id,
        "model_name": model_name,
        "layout_preset": layout_preset,
        "agent_traces": [],
        "executed_results": {},
        "sql_retry_count": 0,
    }
    final_state = await insightforge_graph.ainvoke(initial_state)
    return final_state


async def stream_analysis_pipeline(
    user_query: str,
    connector_id: str = "default_sqlite_commerce",
    model_name: str | None = None,
    layout_preset: str = "executive",
) -> AsyncGenerator[str, None]:
    """Streams real-time LangGraph node transitions and final manifest over Server-Sent Events (SSE)."""
    initial_state: InsightForgeState = {
        "user_query": user_query,
        "connector_id": connector_id,
        "model_name": model_name,
        "layout_preset": layout_preset,
        "agent_traces": [],
        "executed_results": {},
        "sql_retry_count": 0,
    }

    accumulated_state: dict[str, Any] = dict(initial_state)

    async for chunk in insightforge_graph.astream(initial_state, stream_mode="updates"):
        for node_name, node_update in chunk.items():
            accumulated_state.update(node_update)
            traces = node_update.get("agent_traces", [])
            latest_trace = traces[-1] if traces else None
            event_payload = {
                "type": "node_update",
                "node": node_name,
                "trace": latest_trace,
            }
            yield f"data: {json.dumps(event_payload, default=str)}\n\n"

    manifest = accumulated_state.get("pipeline_manifest")
    final_payload = {
        "type": "complete",
        "manifest": manifest.model_dump() if manifest else None,
        "traces": accumulated_state.get("agent_traces", []),
    }
    yield f"data: {json.dumps(final_payload, default=str)}\n\n"
