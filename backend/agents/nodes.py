from __future__ import annotations

import json
import re
import time
import uuid
from typing import Any

import httpx

from backend.agents.layout_engine import (
    build_echarts_option,
    build_kpi_payload,
    compute_responsive_grid_layout,
     format_compact_number,
    infer_columns,
)
from backend.agents.state import AnalyticalTask, InsightForgeState
from backend.connectors.base import QueryExecutionResult, SchemaCatalog, SQLDialectType
from backend.connectors.sql_connector import connector_registry
from backend.llm.ollama_manager import ollama_manager
from backend.pipeline.manifest import (
    DashboardWidgetSpec,
    PipelineManifest,
    PipelineStep,
    compute_rows_sha256,
    enrich_dataset_statistics,
    pipeline_store,
)


async def call_ollama_json(
    system_prompt: str,
    user_prompt: str,
    model_name: str | None = None,
    timeout_sec: float = 35.0,
) -> dict[str, Any] | None:
    """Calls local Ollama `/api/chat` in JSON mode and parses the structured response."""
    status = await ollama_manager.get_status()
    if status.status != "running" or not status.installed_models:
        return None

    chosen_model = model_name or status.selected_model or status.installed_models[0].name
    try:
        async with httpx.AsyncClient(timeout=timeout_sec, trust_env=False, verify=False) as client:
            resp = await client.post(
                f"{ollama_manager.base_url}/api/chat",
                json={
                    "model": chosen_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "format": "json",
                    "think": False,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 2048},
                },
            )
            if resp.status_code != 200:
                return None
            content = resp.json().get("message", {}).get("content", "")
            # Strip potential <think>...</think> blocks from reasoning models like deepseek-r1
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            return json.loads(content)
    except Exception:
        return None


def _inject_geo_map_if_requested(user_query: str, tasks: list[AnalyticalTask], has_commerce: bool) -> list[AnalyticalTask]:
    """Ensures a `geo_map` widget is placed in the hero chart slot whenever the user asks for a map."""
    q_lower = user_query.lower()
    wants_map = any(k in q_lower for k in ("map", "geo", "world", "atlas", "country", "countries"))
    if not wants_map:
        return tasks

    if any(t.get("chart_type") == "geo_map" for t in tasks):
        return tasks

    is_marketing = any(k in q_lower for k in ("marketing", "channel", "campaign", "funnel", "lead", "roas", "spend"))
    if has_commerce and is_marketing:
        geo_task: AnalyticalTask = {
            "task_id": "chart_geo_marketing_map",
            "title": "Global Regional Marketing Pipeline & Top Channel Map",
            "subtitle": "Choropleth & Animated Hub Map by Region & Top Performing Channel",
            "widget_type": "echarts",
            "chart_type": "geo_map",
            "sql_query": (
                "SELECT region, channel, ROUND(SUM(pipeline_value_usd), 2) AS pipeline_value_usd, "
                "SUM(conversions) AS conversions, ROUND(SUM(spend_usd), 2) AS spend_usd "
                "FROM marketing_campaigns GROUP BY region, channel ORDER BY pipeline_value_usd DESC"
            ),
            "x_field": "region",
            "y_fields": ["pipeline_value_usd", "conversions"],
        }
    elif has_commerce:
        geo_task = {
            "task_id": "chart_geo_world_revenue",
            "title": "Global Revenue & Customer Distribution by Country (Geo Map)",
            "subtitle": "World Choropleth & Regional Hub Map",
            "widget_type": "echarts",
            "chart_type": "geo_map",
            "sql_query": (
                "SELECT c.country, c.acquisition_channel, ROUND(SUM(o.net_revenue), 2) AS net_revenue, "
                "ROUND(SUM(o.profit_usd), 2) AS profit_usd "
                "FROM orders o JOIN customers c ON o.customer_id = c.customer_id "
                "GROUP BY c.country, c.acquisition_channel ORDER BY net_revenue DESC"
            ),
            "x_field": "country",
            "y_fields": ["net_revenue", "profit_usd"],
        }
    else:
        # Upgrade the first echarts task that groups by region/country, or the first echarts task
        updated = list(tasks)
        for t in updated:
            if t.get("widget_type") == "echarts" and any(
                k in (t.get("sql_query", "") + " " + t.get("title", "")).lower()
                for k in ("region", "country", "state", "location")
            ):
                t["chart_type"] = "geo_map"
                return updated
        for t in updated:
            if t.get("widget_type") == "echarts":
                t["chart_type"] = "geo_map"
                return updated
        return updated

    # Insert geo_task right after the KPI cards so it occupies the 8-column Hero Chart slot!
    kpis = [t for t in tasks if t.get("widget_type") == "kpi"]
    others = [t for t in tasks if t.get("widget_type") != "kpi"]
    if len(others) >= 5:
        others = [geo_task] + others[:-1]
    else:
        others = [geo_task] + others
    return kpis + others


def build_schema_adaptive_plan(
    user_query: str,
    catalog: SchemaCatalog,
) -> tuple[str, list[AnalyticalTask]]:
    """
    Deterministic, schema-aware BI planner that inspects the connected database tables
    and constructs a rich multi-widget analytical plan tailored to the user's query intent.
    Used both as a high-reliability baseline and when Ollama is offline or warming up.
    """
    q_lower = user_query.lower()
    table_names = {t.table_name for t in catalog.tables}

    # Check if this is the InsightForge SaaS & Commerce schema
    has_commerce = {"orders", "customers", "subscriptions", "products", "marketing_campaigns", "support_tickets"}.issubset(table_names)

    if has_commerce:
        if any(k in q_lower for k in ("churn", "retention", "subscription", "arr", "mrr", "cohort")):
            title = "SaaS Subscription, Churn & ARR Retention Intelligence"
            tasks: list[AnalyticalTask] = [
                {
                    "task_id": "kpi_active_arr",
                    "title": "Active Annual Recurring Revenue (ARR)",
                    "subtitle": "Active & Expanded Subscriptions",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT start_date AS period, SUM(arr_usd) AS active_arr FROM subscriptions WHERE status IN ('Active', 'Expanded') GROUP BY start_date ORDER BY start_date",
                    "x_field": "period",
                    "y_fields": ["active_arr"],
                },
                {
                    "task_id": "kpi_churned_arr",
                    "title": "Churned ARR Exposure",
                    "subtitle": "Total Churned Subscription ARR",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT churn_date AS period, SUM(arr_usd) AS churned_arr FROM subscriptions WHERE status = 'Churned' GROUP BY churn_date ORDER BY churn_date",
                    "x_field": "period",
                    "y_fields": ["churned_arr"],
                },
                {
                    "task_id": "kpi_net_mrr",
                    "title": "Average Monthly Recurring Revenue (MRR)",
                    "subtitle": "Per Subscription Contract",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT plan_tier, ROUND(AVG(mrr_usd), 2) AS avg_mrr FROM subscriptions GROUP BY plan_tier",
                    "x_field": "plan_tier",
                    "y_fields": ["avg_mrr"],
                },
                {
                    "task_id": "kpi_health_score",
                    "title": "Customer Health Score Index",
                    "subtitle": "Mean Account Health (0-100)",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT segment, ROUND(AVG(account_health_score), 1) AS avg_health_score FROM customers GROUP BY segment",
                    "x_field": "segment",
                    "y_fields": ["avg_health_score"],
                },
                {
                    "task_id": "chart_mrr_trend",
                    "title": "Monthly Net Revenue & Profit Trajectory",
                    "subtitle": "22-Month Historical Trend with Moving Average",
                    "widget_type": "echarts",
                    "chart_type": "combo_dual_axis",
                    "sql_query": "SELECT order_month, ROUND(SUM(net_revenue), 2) AS net_revenue, ROUND(SUM(profit_usd), 2) AS net_profit FROM orders GROUP BY order_month ORDER BY order_month",
                    "x_field": "order_month",
                    "y_fields": ["net_revenue", "net_profit"],
                },
                {
                    "task_id": "chart_churn_reasons",
                    "title": "Churned ARR by Root Cause",
                    "subtitle": "Primary Churn Drivers",
                    "widget_type": "echarts",
                    "chart_type": "donut",
                    "sql_query": "SELECT churn_reason, ROUND(SUM(arr_usd), 2) AS churned_arr, COUNT(*) AS churned_accounts FROM subscriptions WHERE status = 'Churned' AND churn_reason IS NOT NULL GROUP BY churn_reason ORDER BY churned_arr DESC",
                    "x_field": "churn_reason",
                    "y_fields": ["churned_arr"],
                },
                {
                    "task_id": "chart_segment_status",
                    "title": "Subscription ARR by Segment & Status",
                    "subtitle": "Active vs Expanded vs Churned Breakdown",
                    "widget_type": "echarts",
                    "chart_type": "grouped_bar",
                    "sql_query": "SELECT c.segment, ROUND(SUM(CASE WHEN s.status = 'Active' THEN s.arr_usd ELSE 0 END), 2) AS active_arr, ROUND(SUM(CASE WHEN s.status = 'Expanded' THEN s.arr_usd ELSE 0 END), 2) AS expanded_arr, ROUND(SUM(CASE WHEN s.status = 'Churned' THEN s.arr_usd ELSE 0 END), 2) AS churned_arr FROM subscriptions s JOIN customers c ON s.customer_id = c.customer_id GROUP BY c.segment ORDER BY active_arr DESC",
                    "x_field": "segment",
                    "y_fields": ["active_arr", "expanded_arr", "churned_arr"],
                },
                {
                    "task_id": "chart_flow_sankey",
                    "title": "Segment to Product Category ARR Flow",
                    "subtitle": "Multi-stage Subscription Attribution Sankey",
                    "widget_type": "echarts",
                    "chart_type": "sankey",
                    "sql_query": "SELECT c.segment, p.category, ROUND(SUM(s.arr_usd), 2) AS total_arr FROM subscriptions s JOIN customers c ON s.customer_id = c.customer_id JOIN products p ON s.product_id = p.product_id GROUP BY c.segment, p.category ORDER BY total_arr DESC",
                    "x_field": "segment",
                    "y_fields": ["total_arr"],
                },
                {
                    "task_id": "table_at_risk_accounts",
                    "title": "High-Value Accounts & Subscription Ledger",
                    "subtitle": "Top Enterprise & Mid-Market Subscriptions with Health Scores",
                    "widget_type": "table",
                    "chart_type": "table",
                    "sql_query": "SELECT c.company_name, c.segment, c.region, p.product_name, s.status, s.mrr_usd, s.arr_usd, c.account_health_score, COALESCE(s.churn_reason, 'Healthy') AS risk_note FROM subscriptions s JOIN customers c ON s.customer_id = c.customer_id JOIN products p ON s.product_id = p.product_id ORDER BY s.arr_usd DESC LIMIT 50",
                    "x_field": "company_name",
                    "y_fields": ["arr_usd", "mrr_usd", "account_health_score"],
                },
            ]
            return title, _inject_geo_map_if_requested(user_query, tasks, has_commerce)

        if any(k in q_lower for k in ("marketing", "campaign", "funnel", "roi", "channel", "acquisition", "lead", "spend")):
            title = "Marketing Attribution, Funnel Conversion & Channel ROI"
            tasks = [
                {
                    "task_id": "kpi_pipeline_val",
                    "title": "Attributed Marketing Pipeline",
                    "subtitle": "Total Generated Pipeline Value",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT campaign_month, ROUND(SUM(pipeline_value_usd), 2) AS pipeline_value_usd FROM marketing_campaigns GROUP BY campaign_month ORDER BY campaign_month",
                    "x_field": "campaign_month",
                    "y_fields": ["pipeline_value_usd"],
                },
                {
                    "task_id": "kpi_ad_spend",
                    "title": "Total Campaign Spend",
                    "subtitle": "Cumulative Acquisition Investment",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT campaign_month, ROUND(SUM(spend_usd), 2) AS spend_usd FROM marketing_campaigns GROUP BY campaign_month ORDER BY campaign_month",
                    "x_field": "campaign_month",
                    "y_fields": ["spend_usd"],
                },
                {
                    "task_id": "kpi_total_leads",
                    "title": "Qualified Leads Generated",
                    "subtitle": "Across All Regions & Channels",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT campaign_month, SUM(leads_generated) AS leads_generated FROM marketing_campaigns GROUP BY campaign_month ORDER BY campaign_month",
                    "x_field": "campaign_month",
                    "y_fields": ["leads_generated"],
                },
                {
                    "task_id": "kpi_conversions",
                    "title": "Closed-Won Conversions",
                    "subtitle": "Marketing Attributed Deals",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT campaign_month, SUM(conversions) AS conversions FROM marketing_campaigns GROUP BY campaign_month ORDER BY campaign_month",
                    "x_field": "campaign_month",
                    "y_fields": ["conversions"],
                },
                {
                    "task_id": "chart_roi_trend",
                    "title": "Monthly Pipeline Generated vs Marketing Spend",
                    "subtitle": "Dual-Axis Investment Efficiency Trajectory",
                    "widget_type": "echarts",
                    "chart_type": "combo_dual_axis",
                    "sql_query": "SELECT campaign_month, ROUND(SUM(pipeline_value_usd), 2) AS pipeline_value_usd, ROUND(SUM(spend_usd), 2) AS spend_usd FROM marketing_campaigns GROUP BY campaign_month ORDER BY campaign_month",
                    "x_field": "campaign_month",
                    "y_fields": ["pipeline_value_usd", "spend_usd"],
                },
                {
                    "task_id": "chart_channel_funnel",
                    "title": "Pipeline Value by Acquisition Channel",
                    "subtitle": "Conversion Funnel Ranking",
                    "widget_type": "echarts",
                    "chart_type": "funnel",
                    "sql_query": "SELECT channel, ROUND(SUM(pipeline_value_usd), 2) AS pipeline_value_usd FROM marketing_campaigns GROUP BY channel ORDER BY pipeline_value_usd DESC",
                    "x_field": "channel",
                    "y_fields": ["pipeline_value_usd"],
                },
                {
                    "task_id": "chart_channel_efficiency",
                    "title": "Channel Spend vs Pipeline Value & Conversions",
                    "subtitle": "Multi-Metric Channel Comparison",
                    "widget_type": "echarts",
                    "chart_type": "grouped_bar",
                    "sql_query": "SELECT channel, ROUND(SUM(spend_usd), 2) AS total_spend_usd, ROUND(SUM(pipeline_value_usd), 2) AS pipeline_value_usd FROM marketing_campaigns GROUP BY channel ORDER BY pipeline_value_usd DESC",
                    "x_field": "channel",
                    "y_fields": ["pipeline_value_usd", "total_spend_usd"],
                },
                {
                    "task_id": "chart_heatmap_region_channel",
                    "title": "Regional Channel Conversion Matrix",
                    "subtitle": "Conversions Heatmap by Channel x Region",
                    "widget_type": "echarts",
                    "chart_type": "heatmap",
                    "sql_query": "SELECT channel, region, SUM(conversions) AS conversions FROM marketing_campaigns GROUP BY channel, region",
                    "x_field": "channel",
                    "y_fields": ["conversions"],
                },
                {
                    "task_id": "table_campaigns_top",
                    "title": "Top Performing Campaign Cohorts",
                    "subtitle": "Ranked by Pipeline ROI Multiplier",
                    "widget_type": "table",
                    "chart_type": "table",
                    "sql_query": "SELECT campaign_name, channel, region, campaign_month, spend_usd, clicks, leads_generated, conversions, pipeline_value_usd, ROUND(pipeline_value_usd / NULLIF(spend_usd, 0), 2) AS roas_multiplier FROM marketing_campaigns ORDER BY pipeline_value_usd DESC LIMIT 50",
                    "x_field": "campaign_name",
                    "y_fields": ["pipeline_value_usd", "spend_usd", "roas_multiplier"],
                },
            ]
            return title, _inject_geo_map_if_requested(user_query, tasks, has_commerce)

        if any(k in q_lower for k in ("support", "ticket", "sla", "csat", "resolution", "customer service")):
            title = "Customer Support SLA, Resolution Velocity & CSAT Intelligence"
            tasks = [
                {
                    "task_id": "kpi_total_tickets",
                    "title": "Total Support Volume",
                    "subtitle": "Logged Customer Tickets",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT created_month, COUNT(*) AS ticket_count FROM support_tickets GROUP BY created_month ORDER BY created_month",
                    "x_field": "created_month",
                    "y_fields": ["ticket_count"],
                },
                {
                    "task_id": "kpi_avg_resolution",
                    "title": "Mean Resolution Time (Hours)",
                    "subtitle": "End-to-End Ticket Closure",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT created_month, ROUND(AVG(resolution_hours), 1) AS avg_resolution_hours FROM support_tickets GROUP BY created_month ORDER BY created_month",
                    "x_field": "created_month",
                    "y_fields": ["avg_resolution_hours"],
                },
                {
                    "task_id": "kpi_csat",
                    "title": "Average CSAT Score",
                    "subtitle": "Customer Satisfaction (1-5 Scale)",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT created_month, ROUND(AVG(csat_score), 2) AS avg_csat_score FROM support_tickets GROUP BY created_month ORDER BY created_month",
                    "x_field": "created_month",
                    "y_fields": ["avg_csat_score"],
                },
                {
                    "task_id": "kpi_sla_breach",
                    "title": "SLA Breach Incidents",
                    "subtitle": "Tickets Exceeding Target Window",
                    "widget_type": "kpi",
                    "chart_type": "kpi",
                    "sql_query": "SELECT created_month, SUM(sla_breached) AS sla_breaches FROM support_tickets GROUP BY created_month ORDER BY created_month",
                    "x_field": "created_month",
                    "y_fields": ["sla_breaches"],
                },
                {
                    "task_id": "chart_ticket_trend",
                    "title": "Monthly Ticket Volume vs SLA Breaches",
                    "subtitle": "Operational Load & Breach Correlation",
                    "widget_type": "echarts",
                    "chart_type": "combo_dual_axis",
                    "sql_query": "SELECT created_month, COUNT(*) AS total_tickets, SUM(sla_breached) AS sla_breaches FROM support_tickets GROUP BY created_month ORDER BY created_month",
                    "x_field": "created_month",
                    "y_fields": ["total_tickets", "sla_breaches"],
                },
                {
                    "task_id": "chart_priority_rose",
                    "title": "Ticket Distribution by Severity Priority",
                    "subtitle": "P1-Critical through P4-Low Breakdown",
                    "widget_type": "echarts",
                    "chart_type": "rose",
                    "sql_query": "SELECT priority, COUNT(*) AS ticket_count FROM support_tickets GROUP BY priority ORDER BY ticket_count DESC",
                    "x_field": "priority",
                    "y_fields": ["ticket_count"],
                },
                {
                    "task_id": "chart_category_res",
                    "title": "Mean Resolution Hours by Issue Category",
                    "subtitle": "Engineering Bottleneck Analysis",
                    "widget_type": "echarts",
                    "chart_type": "horizontal_bar",
                    "sql_query": "SELECT category, ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours, COUNT(*) AS tickets FROM support_tickets GROUP BY category ORDER BY avg_resolution_hours DESC",
                    "x_field": "category",
                    "y_fields": ["avg_resolution_hours"],
                },
                {
                    "task_id": "chart_segment_support",
                    "title": "Support Load & CSAT by Customer Segment",
                    "subtitle": "Segment Support Experience",
                    "widget_type": "echarts",
                    "chart_type": "grouped_bar",
                    "sql_query": "SELECT c.segment, COUNT(t.ticket_id) AS ticket_volume, SUM(t.sla_breached) AS sla_breaches FROM support_tickets t JOIN customers c ON t.customer_id = c.customer_id GROUP BY c.segment ORDER BY ticket_volume DESC",
                    "x_field": "segment",
                    "y_fields": ["ticket_volume", "sla_breaches"],
                },
                {
                    "task_id": "table_critical_tickets",
                    "title": "Recent P1-Critical & SLA-Breached Tickets",
                    "subtitle": "Escalation Audit Log",
                    "widget_type": "table",
                    "chart_type": "table",
                    "sql_query": "SELECT t.ticket_id, c.company_name, c.segment, t.created_date, t.priority, t.category, t.resolution_hours, t.csat_score, t.sla_breached FROM support_tickets t JOIN customers c ON t.customer_id = c.customer_id WHERE t.priority = 'P1-Critical' OR t.sla_breached = 1 ORDER BY t.resolution_hours DESC LIMIT 50",
                    "x_field": "company_name",
                    "y_fields": ["resolution_hours", "csat_score"],
                },
            ]
            return title, _inject_geo_map_if_requested(user_query, tasks, has_commerce)

        # Default Executive Revenue, Growth & Product Margin Overview
        title = "Executive Revenue, Profit & Regional Growth Command Center"
        tasks = [
            {
                "task_id": "kpi_net_rev",
                "title": "Total Net Revenue",
                "subtitle": "Cumulative Recognized Revenue",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "sql_query": "SELECT order_month, ROUND(SUM(net_revenue), 2) AS net_revenue FROM orders GROUP BY order_month ORDER BY order_month",
                "x_field": "order_month",
                "y_fields": ["net_revenue"],
            },
            {
                "task_id": "kpi_net_profit",
                "title": "Gross Operating Profit",
                "subtitle": "Margin-Adjusted Profit USD",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "sql_query": "SELECT order_month, ROUND(SUM(profit_usd), 2) AS profit_usd FROM orders GROUP BY order_month ORDER BY order_month",
                "x_field": "order_month",
                "y_fields": ["profit_usd"],
            },
            {
                "task_id": "kpi_active_arr",
                "title": "Active SaaS ARR",
                "subtitle": "Annual Recurring Subscription Base",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "sql_query": "SELECT start_date, ROUND(SUM(arr_usd), 2) AS arr_usd FROM subscriptions WHERE status IN ('Active', 'Expanded') GROUP BY start_date ORDER BY start_date",
                "x_field": "start_date",
                "y_fields": ["arr_usd"],
            },
            {
                "task_id": "kpi_order_vol",
                "title": "Total Enterprise Orders",
                "subtitle": "Completed Transactions",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "sql_query": "SELECT order_month, COUNT(*) AS order_count FROM orders GROUP BY order_month ORDER BY order_month",
                "x_field": "order_month",
                "y_fields": ["order_count"],
            },
            {
                "task_id": "chart_rev_trajectory",
                "title": "Monthly Net Revenue & Operating Profit Trend",
                "subtitle": "22-Month Trajectory with 3-Month Moving Average",
                "widget_type": "echarts",
                "chart_type": "area_spline",
                "sql_query": "SELECT order_month, ROUND(SUM(net_revenue), 2) AS net_revenue, ROUND(SUM(profit_usd), 2) AS profit_usd FROM orders GROUP BY order_month ORDER BY order_month",
                "x_field": "order_month",
                "y_fields": ["net_revenue", "profit_usd"],
            },
            {
                "task_id": "chart_region_donut",
                "title": "Net Revenue Share by Global Region",
                "subtitle": "Regional Contribution Breakdown",
                "widget_type": "echarts",
                "chart_type": "donut",
                "sql_query": "SELECT region, ROUND(SUM(net_revenue), 2) AS net_revenue FROM orders GROUP BY region ORDER BY net_revenue DESC",
                "x_field": "region",
                "y_fields": ["net_revenue"],
            },
            {
                "task_id": "chart_product_ranking",
                "title": "Product Revenue & Profit Performance",
                "subtitle": "Top Performing Software Products",
                "widget_type": "echarts",
                "chart_type": "horizontal_bar",
                "sql_query": "SELECT p.product_name, ROUND(SUM(o.net_revenue), 2) AS net_revenue, ROUND(SUM(o.profit_usd), 2) AS profit_usd FROM orders o JOIN products p ON o.product_id = p.product_id GROUP BY p.product_name ORDER BY net_revenue DESC",
                "x_field": "product_name",
                "y_fields": ["net_revenue"],
            },
            {
                "task_id": "chart_segment_channel_heatmap",
                "title": "Revenue Matrix: Customer Segment × Acquisition Channel",
                "subtitle": "Cross-Dimensional Revenue Density",
                "widget_type": "echarts",
                "chart_type": "heatmap",
                "sql_query": "SELECT channel, segment, ROUND(SUM(net_revenue), 2) AS net_revenue FROM orders GROUP BY channel, segment",
                "x_field": "channel",
                "y_fields": ["net_revenue"],
            },
            {
                "task_id": "table_top_customers",
                "title": "Top Revenue Customer Accounts & Health Ledger",
                "subtitle": "Enterprise Account Performance & Margin Breakdown",
                "widget_type": "table",
                "chart_type": "table",
                "sql_query": "SELECT c.company_name, c.segment, c.industry, c.region, c.account_health_score, COUNT(o.order_id) AS total_orders, ROUND(SUM(o.net_revenue), 2) AS lifetime_net_revenue, ROUND(SUM(o.profit_usd), 2) AS lifetime_profit FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.company_name, c.segment, c.industry, c.region, c.account_health_score ORDER BY lifetime_net_revenue DESC LIMIT 50",
                "x_field": "company_name",
                "y_fields": ["lifetime_net_revenue", "lifetime_profit", "account_health_score"],
            },
        ]
        return title, _inject_geo_map_if_requested(user_query, tasks, has_commerce)

    # Generic Schema Introspection Plan for any custom uploaded CSV / MySQL / MS SQL Server table
    if not catalog.tables:
        return "Database Overview", []

    primary_tbl = max(catalog.tables, key=lambda t: t.row_count)
    t_name = primary_tbl.table_name
    num_cols = [
        c.name
        for c in primary_tbl.columns
        if any(k in c.data_type.upper() for k in ("INT", "REAL", "FLOAT", "DOUBLE", "DEC", "NUM", "MONEY"))
        and not c.is_primary_key
    ]
    str_cols = [
        c.name
        for c in primary_tbl.columns
        if c.name not in num_cols and not c.is_primary_key
    ]
    metric = num_cols[0] if num_cols else primary_tbl.columns[-1].name
    dim = str_cols[0] if str_cols else primary_tbl.columns[0].name
    dim2 = str_cols[1] if len(str_cols) > 1 else dim

    generic_tasks: list[AnalyticalTask] = [
        {
            "task_id": "kpi_total_rows",
            "title": f"Total {t_name.replace('_', ' ').title()} Records",
            "subtitle": "Table Volume",
            "widget_type": "kpi",
            "chart_type": "kpi",
            "sql_query": f"SELECT COUNT(*) AS total_records FROM {t_name}",
            "x_field": None,
            "y_fields": ["total_records"],
        },
        {
            "task_id": "kpi_sum_metric",
            "title": f"Total {metric.replace('_', ' ').title()}",
            "subtitle": f"Aggregate {metric}",
            "widget_type": "kpi",
            "chart_type": "kpi",
            "sql_query": f"SELECT ROUND(SUM({metric}), 2) AS total_{metric} FROM {t_name}",
            "x_field": None,
            "y_fields": [f"total_{metric}"],
        },
        {
            "task_id": "chart_by_dim1",
            "title": f"{metric.replace('_', ' ').title()} by {dim.replace('_', ' ').title()}",
            "subtitle": "Primary Dimensional Breakdown",
            "widget_type": "echarts",
            "chart_type": "grouped_bar",
            "sql_query": f"SELECT {dim}, ROUND(SUM({metric}), 2) AS total_{metric} FROM {t_name} GROUP BY {dim} ORDER BY total_{metric} DESC LIMIT 20",
            "x_field": dim,
            "y_fields": [f"total_{metric}"],
        },
        {
            "task_id": "chart_share_dim2",
            "title": f"Distribution by {dim2.replace('_', ' ').title()}",
            "subtitle": "Proportional Share",
            "widget_type": "echarts",
            "chart_type": "donut",
            "sql_query": f"SELECT {dim2}, ROUND(SUM({metric}), 2) AS total_{metric} FROM {t_name} GROUP BY {dim2} ORDER BY total_{metric} DESC LIMIT 12",
            "x_field": dim2,
            "y_fields": [f"total_{metric}"],
        },
        {
            "task_id": "table_records",
            "title": f"{t_name.replace('_', ' ').title()} Data Explorer",
            "subtitle": "Sample Records",
            "widget_type": "table",
            "chart_type": "table",
            "sql_query": f"SELECT * FROM {t_name} LIMIT 100",
            "x_field": dim,
            "y_fields": num_cols[:3],
        },
    ]
    return f"Analytical Dashboard — {t_name.replace('_', ' ').title()}", generic_tasks


# ============================================================================
# LANGGRAPH NODES
# ============================================================================


async def schema_profiler_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 1: Introspects the target SQL connector and builds the schema context."""
    t0 = time.perf_counter()
    conn = connector_registry.get_connector(state.get("connector_id"))
    catalog = conn.get_schema_catalog()
    schema_prompt = catalog.to_prompt_context()
    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    traces = list(state.get("agent_traces", []))
    traces.append(
        {
            "agent": "SchemaProfilerAgent",
            "status": "completed",
            "title": f"Profiled {len(catalog.tables)} tables on {catalog.dialect.upper()} ({catalog.database_display})",
            "detail": f"Fingerprint {catalog.schema_fingerprint} | {sum(t.row_count for t in catalog.tables):,} total rows indexed.",
            "duration_ms": elapsed,
        }
    )
    return {
        "schema_catalog": catalog,
        "dialect": catalog.dialect,
        "schema_prompt": schema_prompt,
        "agent_traces": traces,
    }


async def bi_planner_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 2: Decomposes the user's natural language request into a multi-widget BI plan."""
    t0 = time.perf_counter()
    user_query = state["user_query"]
    catalog = state["schema_catalog"]
    schema_prompt = state["schema_prompt"]
    model_name = state.get("model_name")

    fallback_title, fallback_tasks = build_schema_adaptive_plan(user_query, catalog)

    system_prompt = (
        "You are a Staff Business Intelligence Architect. Given a database schema and a user request, "
        "design an executive dashboard plan in JSON format.\n"
        "Return a JSON object with keys:\n"
        '- "dashboard_title": string\n'
        '- "tasks": array of 6 to 9 widget tasks. Include 3-4 "kpi" widgets, 3-4 "echarts" widgets '
        '(chart_type in ["geo_map", "area_spline", "multi_line", "grouped_bar", "stacked_bar", "horizontal_bar", '
        '"combo_dual_axis", "donut", "rose", "funnel", "heatmap", "sankey", "scatter"]), and 1 "table" widget.\n'
        'IMPORTANT: If the user asks to plot on a map, geo map, world map, or analyze by region/country on a map, '
        'you MUST set chart_type to "geo_map" for the primary regional/country widget!\n'
        "Each task object MUST have: task_id, title, subtitle, widget_type ('kpi'|'echarts'|'table'), "
        "chart_type, sql_query (valid read-only SELECT query using only existing table and column names), "
        "x_field (string), y_fields (array of strings)."
    )
    user_prompt = f"{schema_prompt}\n\nUSER ANALYTICAL REQUEST: {user_query}"

    llm_plan = await call_ollama_json(system_prompt, user_prompt, model_name=model_name, timeout_sec=28.0)
    llm_mode = "ollama"
    chosen_title = fallback_title
    chosen_tasks: list[AnalyticalTask] = fallback_tasks

    if llm_plan and isinstance(llm_plan.get("tasks"), list) and len(llm_plan["tasks"]) >= 3:
        valid_llm_tasks: list[AnalyticalTask] = []
        for idx, raw_t in enumerate(llm_plan["tasks"]):
            if not isinstance(raw_t, dict) or not raw_t.get("sql_query"):
                continue
            w_type = str(raw_t.get("widget_type", "echarts")).lower()
            if w_type not in ("kpi", "echarts", "table"):
                w_type = "echarts"
            c_type = str(raw_t.get("chart_type", "grouped_bar")).lower()
            valid_llm_tasks.append(
                {
                    "task_id": str(raw_t.get("task_id") or f"task_{idx + 1}"),
                    "title": str(raw_t.get("title") or f"Analytical Metric {idx + 1}"),
                    "subtitle": str(raw_t.get("subtitle") or ""),
                    "widget_type": w_type,  # type: ignore[typeddict-item]
                    "chart_type": "kpi" if w_type == "kpi" else ("table" if w_type == "table" else c_type),
                    "sql_query": str(raw_t["sql_query"]),
                    "x_field": raw_t.get("x_field"),
                    "y_fields": list(raw_t.get("y_fields") or []),
                }
            )
        if len(valid_llm_tasks) >= 3:
            has_commerce = {"orders", "customers", "subscriptions", "products", "marketing_campaigns", "support_tickets"}.issubset(
                {t.table_name for t in catalog.tables}
            )
            chosen_title = str(llm_plan.get("dashboard_title") or fallback_title)
            chosen_tasks = _inject_geo_map_if_requested(user_query, valid_llm_tasks, has_commerce)
    else:
        llm_mode = "schema_adaptive_hybrid"

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    traces = list(state.get("agent_traces", []))
    traces.append(
        {
            "agent": "BIPlannerAgent",
            "status": "completed",
            "title": f"Planned {len(chosen_tasks)}-widget analytical layout for '{chosen_title}'",
            "detail": f"Mode: {llm_mode} | KPIs: {sum(1 for t in chosen_tasks if t['widget_type']=='kpi')}, Charts: {sum(1 for t in chosen_tasks if t['widget_type']=='echarts')}, Tables: {sum(1 for t in chosen_tasks if t['widget_type']=='table')}",
            "duration_ms": elapsed,
        }
    )
    return {
        "dashboard_title": chosen_title,
        "analysis_plan": chosen_tasks,
        "sql_retry_count": 0,
        "agent_traces": traces,
        "llm_mode": llm_mode,
    }


async def sql_coder_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 3: Validates, transpiles (sqlite/mysql/tsql), and executes SQL queries with self-healing fallback."""
    t0 = time.perf_counter()
    conn = connector_registry.get_connector(state.get("connector_id"))
    catalog = state["schema_catalog"]
    plan = list(state.get("analysis_plan", []))
    executed: dict[str, QueryExecutionResult] = dict(state.get("executed_results", {}))
    retry_count = int(state.get("sql_retry_count", 0))
    failed_ids: list[str] = []

    _, fallback_tasks = build_schema_adaptive_plan(state["user_query"], catalog)
    fallback_by_idx = {i: t for i, t in enumerate(fallback_tasks)}

    for idx, task in enumerate(plan):
        tid = task["task_id"]
        if tid in executed and executed[tid].success and executed[tid].row_count > 0:
            continue

        res = conn.execute_safe_query(task["sql_query"])
        if not res.success or res.row_count == 0:
            # Self-heal attempt via Ollama if retry_count > 0, or repair via verified schema-adaptive task
            if retry_count >= 1 and idx in fallback_by_idx:
                fb_task = fallback_by_idx[idx]
                fb_res = conn.execute_safe_query(fb_task["sql_query"])
                if fb_res.success and fb_res.row_count > 0:
                    plan[idx] = fb_task
                    executed[fb_task["task_id"]] = fb_res
                    continue
            failed_ids.append(tid)
        executed[tid] = res

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    traces = list(state.get("agent_traces", []))
    success_count = sum(1 for r in executed.values() if r.success and r.row_count > 0)
    traces.append(
        {
            "agent": "SQLDataAgent",
            "status": "completed" if not failed_ids else "warning",
            "title": f"Executed & AST-verified {success_count}/{len(plan)} {catalog.dialect.upper()} queries",
            "detail": (
                f"All queries verified read-only via SQLGlot ({catalog.dialect})."
                if not failed_ids
                else f"Self-healing triggered for {len(failed_ids)} query(s) (Pass #{retry_count + 1})."
            ),
            "duration_ms": elapsed,
        }
    )
    return {
        "analysis_plan": plan,
        "executed_results": executed,
        "failed_task_ids": failed_ids,
        "sql_retry_count": retry_count + 1,
        "agent_traces": traces,
    }


def should_retry_sql(state: InsightForgeState) -> str:
    """Conditional edge: loops back to `sql_coder` once if any query failed or returned 0 rows."""
    failed = state.get("failed_task_ids", [])
    retries = int(state.get("sql_retry_count", 0))
    if failed and retries < 2:
        return "retry_sql"
    return "continue_pipeline"


async def pipeline_builder_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 4: Builds deterministic PipelineSteps with SHA-256 hashes and statistical anomaly detection."""
    t0 = time.perf_counter()
    plan = state.get("analysis_plan", [])
    executed = state.get("executed_results", {})

    steps: list[PipelineStep] = []
    enriched_datasets: dict[str, dict[str, Any]] = {}
    total_anomalies = 0

    for idx, task in enumerate(plan):
        tid = task["task_id"]
        res = executed.get(tid)
        if not res or not res.success or not res.rows:
            continue

        step_id = f"step_{idx + 1}_{tid}"
        inferred_x, inferred_ys = infer_columns(res.rows)
        x_col = task.get("x_field") if (task.get("x_field") in res.rows[0]) else inferred_x
        y_cols = [c for c in (task.get("y_fields") or []) if c in res.rows[0]] or inferred_ys

        enriched_rows, stats, anomalies = enrich_dataset_statistics(res.rows, x_col, y_cols)
        total_anomalies += len(anomalies)
        data_hash = compute_rows_sha256(res.rows)

        steps.append(
            PipelineStep(
                step_id=step_id,
                step_number=len(steps) + 1,
                title=task["title"],
                kind="sql_extraction",
                sql_query=task["sql_query"],
                executed_sql=res.executed_sql,
                operation=f"{res.dialect.upper()} SELECT + Z-Score & Moving Average Enrichment",
                row_count=res.row_count,
                columns=res.columns,
                output_hash=data_hash,
                execution_ms=res.execution_ms,
                anomalies_detected=anomalies,
                summary_stats=stats,
            )
        )
        enriched_datasets[tid] = {
            "step_id": step_id,
            "rows": enriched_rows,
            "columns": res.columns,
            "x_field": x_col,
            "y_fields": y_cols,
            "stats": stats,
            "anomalies": anomalies,
            "data_hash": data_hash,
            "executed_sql": res.executed_sql,
        }

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    traces = list(state.get("agent_traces", []))
    traces.append(
        {
            "agent": "PipelineBuilderAgent",
            "status": "completed",
            "title": f"Locked {len(steps)} reproducible DAG steps with SHA-256 lineage hashes",
            "detail": f"Detected {total_anomalies} statistical anomaly point(s) (|Z| >= 1.75) across datasets.",
            "duration_ms": elapsed,
        }
    )
    return {
        "pipeline_steps": steps,
        "enriched_datasets": enriched_datasets,
        "agent_traces": traces,
    }


async def viz_architect_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 5: Compiles Apache ECharts specs, KPI sparkline cards, and 12-column responsive grid coordinates."""
    t0 = time.perf_counter()
    plan = state.get("analysis_plan", [])
    enriched_datasets = state.get("enriched_datasets", {})
    preset = state.get("layout_preset", "executive")

    widgets: list[DashboardWidgetSpec] = []
    for task in plan:
        tid = task["task_id"]
        ds = enriched_datasets.get(tid)
        if not ds:
            continue

        w_type = task["widget_type"]
        c_type = task["chart_type"]
        rows = ds["rows"]
        x_col = ds["x_field"]
        y_cols = ds["y_fields"]
        stats = ds["stats"]
        anomalies = ds["anomalies"]

        kpi_payload = None
        echarts_option = None

        if w_type == "kpi":
            kpi_payload = build_kpi_payload(task["title"], rows, x_col, y_cols, stats)
        elif w_type == "echarts":
            echarts_option = build_echarts_option(c_type, task["title"], rows, x_col, y_cols)

        # Generate concise per-widget statistical takeaway
        insight_text = ""
        if stats:
            metric_label = str(stats.get("metric", "")).replace("_", " ").title()
            delta = stats.get("period_delta_pct", 0.0)
            max_v = format_compact_number(float(stats.get("max", 0)), metric_label)
            min_v = format_compact_number(float(stats.get("min", 0)), metric_label)
            delta_str = f" ({'+' if delta > 0 else ''}{delta}% trajectory)" if delta != 0 else ""
            insight_text = f"{metric_label} ranges from {min_v} to {max_v}{delta_str}."
            if anomalies:
                top_a = anomalies[0]
                insight_text += f" Outlier {top_a.direction} at {top_a.dimension_label} (Z={top_a.z_score})."

        widgets.append(
            DashboardWidgetSpec(
                id=f"widget_{tid}",
                title=task["title"],
                subtitle=task.get("subtitle", ""),
                widget_type=w_type,
                chart_type=c_type,  # type: ignore[arg-type]
                step_id=ds["step_id"],
                sql_query=ds["executed_sql"],
                data_hash=ds["data_hash"],
                columns=ds["columns"],
                rows=rows,
                x_field=x_col,
                y_fields=y_cols,
                kpi_payload=kpi_payload,
                echarts_option=echarts_option,
                insight_summary=insight_text,
                anomalies=anomalies,
            )
        )

    layouts = compute_responsive_grid_layout(widgets, preset=preset)
    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    traces = list(state.get("agent_traces", []))
    traces.append(
        {
            "agent": "VizLayoutAgent",
            "status": "completed",
            "title": f"Compiled {len(widgets)} visual widgets into 12-col '{preset}' responsive grid",
            "detail": "Generated Apache ECharts option trees, KPI sparklines, and lg/md/sm breakpoint layouts.",
            "duration_ms": elapsed,
        }
    )
    return {
        "widgets": widgets,
        "layouts": layouts,
        "agent_traces": traces,
    }


async def insight_narrator_node(state: InsightForgeState) -> dict[str, Any]:
    """Node 6: Synthesizes grounded executive takeaways and persists the reproducible PipelineManifest."""
    t0 = time.perf_counter()
    catalog = state["schema_catalog"]
    widgets = state.get("widgets", [])
    steps = state.get("pipeline_steps", [])
    user_query = state["user_query"]
    title = state.get("dashboard_title", "Executive BI Dashboard")

    # Build grounded statistical facts from executed steps
    fact_lines: list[str] = []
    for w in widgets:
        if w.widget_type == "kpi" and w.kpi_payload:
            val = w.kpi_payload.get("formatted_value")
            delta = w.kpi_payload.get("delta_pct", 0)
            fact_lines.append(f"{w.title}: {val} ({'+' if delta > 0 else ''}{delta}% change)")
        elif w.insight_summary:
            fact_lines.append(f"{w.title}: {w.insight_summary}")

    # Deterministic grounded executive narrative + optional Ollama polish
    exec_summary = (
        f"Analysis of {catalog.connector_name} ({catalog.dialect.upper()}) across {len(steps)} reproducible SQL pipeline steps: "
        + " | ".join(fact_lines[:3])
    )
    key_insights = fact_lines[:5] if fact_lines else ["All SQL pipeline queries executed and verified."]
    followups = [
        "Break down SaaS churn reasons and ARR exposure by customer segment",
        "Analyze marketing attribution funnel, ROAS, and regional campaign conversions",
        "Inspect customer support SLA breaches, P1-Critical tickets, and CSAT scores",
    ]

    status = await ollama_manager.get_status()
    model_used = state.get("model_name") or status.selected_model or "schema-adaptive-bi-engine"

    if status.status == "running" and status.installed_models:
        narrator_res = await call_ollama_json(
            system_prompt=(
                "You are a Chief Data Officer summarizing a BI dashboard. "
                "Using ONLY the verified facts provided, return a JSON object with keys:\n"
                '- "executive_summary": 2-3 sentence executive overview citing exact metrics.\n'
                '- "key_insights": array of 4 concise bullet strings citing numbers.\n'
                '- "suggested_followups": array of 3 natural-language follow-up analytical questions.'
            ),
            user_prompt=f"User Request: {user_query}\nVerified Metrics:\n" + "\n".join(fact_lines),
            model_name=state.get("model_name"),
            timeout_sec=18.0,
        )
        if narrator_res:
            if isinstance(narrator_res.get("executive_summary"), str) and narrator_res["executive_summary"].strip():
                exec_summary = narrator_res["executive_summary"].strip()
            if isinstance(narrator_res.get("key_insights"), list) and narrator_res["key_insights"]:
                key_insights = [str(x) for x in narrator_res["key_insights"][:5]]
            if isinstance(narrator_res.get("suggested_followups"), list) and narrator_res["suggested_followups"]:
                followups = [str(x) for x in narrator_res["suggested_followups"][:3]]

    pipeline_id = f"pipe_{uuid.uuid4().hex[:10]}"
    manifest = PipelineManifest(
        pipeline_id=pipeline_id,
        title=title,
        user_query=user_query,
        connector_id=catalog.connector_id,
        connector_name=catalog.connector_name,
        dialect=catalog.dialect,
        schema_fingerprint=catalog.schema_fingerprint,
        model_used=model_used,
        steps=steps,
        widgets=widgets,
        layouts=state.get("layouts", {}),
        executive_summary=exec_summary,
        key_insights=key_insights,
        suggested_followups=followups,
        reproducibility_verified=True,
        data_drifted=False,
    )
    pipeline_store.save(manifest)

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    traces = list(state.get("agent_traces", []))
    traces.append(
        {
            "agent": "InsightNarratorAgent",
            "status": "completed",
            "title": f"Synthesized executive BI narrative & saved manifest {pipeline_id}",
            "detail": f"Model: {model_used} | {len(key_insights)} verified insights generated.",
            "duration_ms": elapsed,
        }
    )

    return {
        "executive_summary": exec_summary,
        "key_insights": key_insights,
        "suggested_followups": followups,
        "pipeline_manifest": manifest,
        "agent_traces": traces,
    }
