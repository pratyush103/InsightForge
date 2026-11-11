from __future__ import annotations

import math
import re
from typing import Any

from backend.pipeline.manifest import DashboardWidgetSpec, GridCoordinates

GEO_COORDINATES: dict[str, tuple[float, float]] = {
    # Global Macro-Regions
    "north america": (-98.5, 39.8),
    "na": (-98.5, 39.8),
    "us": (-98.5, 39.8),
    "europe": (10.4, 50.1),
    "emea": (14.5, 48.0),
    "eu": (10.4, 50.1),
    "apac": (116.0, 22.3),
    "asia pacific": (116.0, 22.3),
    "asia": (105.0, 32.0),
    "latam": (-58.4, -14.2),
    "latin america": (-58.4, -14.2),
    "south america": (-58.4, -18.0),
    "mea": (28.0, 12.0),
    "middle east": (45.0, 24.0),
    "africa": (20.0, 2.0),
    # Countries
    "united states": (-98.58, 39.83),
    "usa": (-98.58, 39.83),
    "canada": (-106.35, 56.13),
    "mexico": (-102.55, 23.63),
    "brazil": (-51.93, -14.24),
    "colombia": (-74.30, 4.57),
    "argentina": (-63.62, -38.42),
    "chile": (-71.54, -35.68),
    "peru": (-75.02, -9.19),
    "united kingdom": (-2.5, 54.0),
    "uk": (-2.5, 54.0),
    "germany": (10.45, 51.17),
    "france": (2.21, 46.23),
    "netherlands": (5.29, 52.13),
    "sweden": (18.64, 60.13),
    "norway": (8.47, 60.47),
    "spain": (-3.75, 40.46),
    "italy": (12.57, 41.87),
    "poland": (19.15, 51.92),
    "ireland": (-8.24, 53.41),
    "switzerland": (8.23, 46.82),
    "india": (78.96, 20.59),
    "singapore": (103.82, 1.35),
    "japan": (138.25, 36.20),
    "australia": (133.78, -25.27),
    "china": (104.20, 35.86),
    "indonesia": (113.92, -0.79),
    "south korea": (127.77, 35.91),
}

REGION_TO_COUNTRIES: dict[str, list[str]] = {
    "north america": ["United States", "Canada"],
    "europe": ["United Kingdom", "Germany", "France", "Netherlands", "Sweden", "Norway", "Spain", "Italy", "Poland", "Ireland"],
    "apac": ["India", "China", "Japan", "Singapore", "Australia", "Indonesia"],
    "latam": ["Brazil", "Mexico", "Colombia", "Argentina", "Chile", "Peru"],
}

BRAND_PALETTE = [
    "#6366f1",  # Indigo
    "#06b6d4",  # Cyan
    "#10b981",  # Emerald
    "#f59e0b",  # Amber
    "#ec4899",  # Pink
    "#8b5cf6",  # Violet
    "#3b82f6",  # Blue
    "#14b8a6",  # Teal
]


def format_compact_number(val: float, metric_name: str = "") -> str:
    """Formats numbers into executive BI notation ($1.42M, 84.2%, 12.4K)."""
    lower_name = metric_name.lower()
    is_currency = bool(
        re.search(r"(?:^|_|\b)(rev|revenue|mrr|arr|spend|profit|price|value|discount|usd|cost)(?:$|_|\b)", lower_name)
    )
    is_percent = bool(
        re.search(r"(?:^|_|\b)(pct|percent|margin|share|ratio|rate)(?:$|_|\b)", lower_name)
    )

    prefix = "$" if is_currency else ""
    suffix = "%" if is_percent else ""

    if is_percent and abs(val) <= 1.0 and val != 0:
        val = val * 100.0

    abs_v = abs(val)
    if abs_v >= 1_000_000_000:
        return f"{prefix}{val / 1_000_000_000:.2f}B{suffix}"
    if abs_v >= 1_000_000:
        return f"{prefix}{val / 1_000_000:.2f}M{suffix}"
    if abs_v >= 10_000:
        return f"{prefix}{val / 1_000:.1f}K{suffix}"
    if abs_v >= 100:
        return f"{prefix}{val:,.0f}{suffix}"
    if abs_v == int(abs_v):
        return f"{prefix}{int(val)}{suffix}"
    return f"{prefix}{val:.2f}{suffix}"


def infer_columns(rows: list[dict[str, Any]]) -> tuple[str | None, list[str]]:
    """Infers the primary dimension (X) column and numeric measure (Y) columns from SQL output."""
    if not rows:
        return None, []
    sample = rows[0]
    cols = [c for c in sample.keys() if not c.endswith("_ma3") and not c.endswith("_zscore")]

    numeric_cols: list[str] = []
    dim_cols: list[str] = []
    for c in cols:
        non_null = [r.get(c) for r in rows[:20] if r.get(c) is not None]
        if non_null and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in non_null):
            if c.lower().endswith("_id") and len(cols) > 1:
                dim_cols.append(c)
            else:
                numeric_cols.append(c)
        else:
            dim_cols.append(c)

    x_field = dim_cols[0] if dim_cols else (cols[0] if cols else None)
    if not numeric_cols and len(cols) > 1:
        for c in cols[1:]:
            try:
                float(rows[0].get(c))
                numeric_cols.append(c)
            except Exception:
                pass
    return x_field, numeric_cols


def build_kpi_payload(
    title: str,
    rows: list[dict[str, Any]],
    x_field: str | None,
    y_fields: list[str],
    stats: dict[str, Any],
) -> dict[str, Any]:
    """Constructs executive KPI card payload with sparkline array and period delta."""
    if not rows:
        return {
            "formatted_value": "0",
            "raw_value": 0,
            "metric_label": title,
            "delta_pct": 0.0,
            "delta_direction": "neutral",
            "sparkline": [],
            "subtext": "No rows returned",
        }

    if not y_fields:
        _, y_fields = infer_columns(rows)

    primary_col = y_fields[0] if y_fields else list(rows[0].keys())[-1]
    series_vals: list[float] = []
    for r in rows:
        v = r.get(primary_col)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            series_vals.append(float(v))

    if not series_vals:
        raw_val = 0.0
    elif len(series_vals) == 1:
        raw_val = series_vals[0]
    else:
        lower_col = primary_col.lower()
        if any(k in lower_col for k in ("avg", "mean", "score", "rate", "pct", "margin", "hours")):
            raw_val = sum(series_vals) / len(series_vals)
        else:
            raw_val = sum(series_vals)

    delta_pct = float(stats.get("period_delta_pct", 0.0))
    if len(series_vals) >= 2 and delta_pct == 0.0 and series_vals[0] != 0:
        delta_pct = round(((series_vals[-1] - series_vals[0]) / abs(series_vals[0])) * 100.0, 1)

    direction = "up" if delta_pct > 0.5 else ("down" if delta_pct < -0.5 else "neutral")
    subtext = f"Across {len(series_vals)} periods" if len(series_vals) > 1 else "Current aggregate"
    if len(rows) == 1 and len(rows[0]) >= 2:
        # Check if second numeric column is a comparison or delta
        other_nums = [
            (k, float(v))
            for k, v in rows[0].items()
            if k != primary_col and isinstance(v, (int, float)) and not isinstance(v, bool)
        ]
        if other_nums:
            sec_k, sec_v = other_nums[0]
            subtext = f"{sec_k.replace('_', ' ').title()}: {format_compact_number(sec_v, sec_k)}"

    return {
        "formatted_value": format_compact_number(raw_val, primary_col or title),
        "raw_value": round(raw_val, 2),
        "metric_label": primary_col.replace("_", " ").title(),
        "delta_pct": delta_pct,
        "delta_direction": direction,
        "sparkline": [round(v, 2) for v in series_vals[-24:]],
        "subtext": subtext,
    }


def build_echarts_option(
    chart_type: str,
    title: str,
    rows: list[dict[str, Any]],
    x_field: str | None = None,
    y_fields: list[str] | None = None,
    series_field: str | None = None,
) -> dict[str, Any]:
    """
    Compiles dataset rows and a chart archetype into a rich, responsive Apache ECharts option object.
    """
    if not rows:
        return {"title": {"text": "No Data Available", "left": "center", "top": "center"}}

    inferred_x, inferred_ys = infer_columns(rows)
    x_col = x_field if (x_field and x_field in rows[0]) else inferred_x
    y_cols = [c for c in (y_fields or []) if c in rows[0]] or inferred_ys
    if not y_cols:
        y_cols = [list(rows[0].keys())[-1]]

    primary_y = y_cols[0]
    secondary_y = y_cols[1] if len(y_cols) > 1 else None
    categories = [str(r.get(x_col, f"#{i + 1}")) for i, r in enumerate(rows)]

    base_tooltip = {
        "trigger": "axis" if chart_type not in ("donut", "rose", "funnel", "treemap", "sankey", "geo_map") else "item",
        "backgroundColor": "rgba(15, 23, 42, 0.94)",
        "borderColor": "rgba(99, 102, 241, 0.35)",
        "borderWidth": 1,
        "textStyle": {"color": "#f8fafc", "fontSize": 12},
        "confine": True,
    }

    # 0. GEOGRAPHIC WORLD MAP (CHOROPLETH + RIPPLE HUBS)
    if chart_type == "geo_map":
        str_cols = [c for c in rows[0].keys() if isinstance(rows[0].get(c), str)]
        loc_col = x_col
        for cand in str_cols:
            if any(k in cand.lower() for k in ("region", "country", "nation", "location", "market", "state")):
                loc_col = cand
                break
        sub_dim_cols = [c for c in str_cols if c != loc_col]
        sub_dim_col = sub_dim_cols[0] if sub_dim_cols else None

        # Aggregate by location (recording total primary metric and top secondary category such as top channel)
        loc_totals: dict[str, float] = {}
        loc_top_sub: dict[str, tuple[str, float]] = {}
        for r in rows:
            raw_loc = str(r.get(loc_col, "")).strip()
            if not raw_loc:
                continue
            v = float(r.get(primary_y, 0) or 0)
            loc_totals[raw_loc] = loc_totals.get(raw_loc, 0.0) + v
            if sub_dim_col:
                sub_val = str(r.get(sub_dim_col, "")).strip()
                prev_best = loc_top_sub.get(raw_loc)
                if prev_best is None or v > prev_best[1]:
                    loc_top_sub[raw_loc] = (sub_val, v)

        choropleth_data: list[dict[str, Any]] = []
        scatter_data: list[dict[str, Any]] = []
        max_val = max(loc_totals.values()) if loc_totals else 100.0
        min_val = min(loc_totals.values()) if loc_totals else 0.0

        for loc_name, total_v in loc_totals.items():
            key_lower = loc_name.lower().strip()
            coord = GEO_COORDINATES.get(key_lower)
            top_sub_label = loc_top_sub[loc_name][0] if loc_name in loc_top_sub else ""
            display_label = f"{loc_name} ({top_sub_label})" if top_sub_label else loc_name
            formatted_v = format_compact_number(total_v, primary_y)

            if coord:
                scatter_data.append(
                    {
                        "name": display_label,
                        "location": loc_name,
                        "top_category": top_sub_label,
                        "formatted": formatted_v,
                        "value": [coord[0], coord[1], round(total_v, 2)],
                    }
                )

            # Map region or country to GeoJSON country polygons
            if key_lower in REGION_TO_COUNTRIES:
                for c_name in REGION_TO_COUNTRIES[key_lower]:
                    choropleth_data.append({"name": c_name, "value": round(total_v, 2), "region": loc_name})
            else:
                choropleth_data.append({"name": loc_name, "value": round(total_v, 2), "region": loc_name})

        return {
            "backgroundColor": "transparent",
            "tooltip": {
                **base_tooltip,
                "trigger": "item",
            },
            "visualMap": {
                "min": min(0, min_val),
                "max": max(max_val, 1.0),
                "left": 12,
                "bottom": 10,
                "text": ["High", "Low"],
                "calculable": True,
                "orient": "horizontal",
                "inRange": {
                    "color": ["#1e1b4b", "#3730a3", "#4f46e5", "#06b6d4", "#10b981"],
                },
                "textStyle": {"color": "#94a3b8", "fontSize": 10},
            },
            "geo": {
                "map": "world",
                "roam": True,
                "zoom": 1.18,
                "center": [12, 18],
                "itemStyle": {
                    "areaColor": "#1e293b",
                    "borderColor": "#334155",
                    "borderWidth": 1,
                },
                "emphasis": {
                    "itemStyle": {
                        "areaColor": "#4f46e5",
                    },
                    "label": {"show": True, "color": "#f8fafc", "fontSize": 11},
                },
            },
            "series": [
                {
                    "name": primary_y.replace("_", " ").title(),
                    "type": "map",
                    "geoIndex": 0,
                    "data": choropleth_data,
                },
                {
                    "name": "Regional Hub",
                    "type": "effectScatter",
                    "coordinateSystem": "geo",
                    "data": scatter_data,
                    "symbolSize": 16,
                    "showEffectOn": "render",
                    "rippleEffect": {"brushType": "stroke", "scale": 3.6, "period": 4},
                    "itemStyle": {
                        "color": "#10b981",
                        "shadowBlur": 14,
                        "shadowColor": "#10b981",
                    },
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{b}",
                        "color": "#f8fafc",
                        "fontSize": 11,
                        "fontWeight": "bold",
                        "backgroundColor": "rgba(15, 23, 42, 0.82)",
                        "borderColor": "rgba(16, 185, 129, 0.45)",
                        "borderWidth": 1,
                        "borderRadius": 4,
                        "padding": [3, 6],
                    },
                    "zlevel": 2,
                },
            ],
        }

    # 1. DONUT / NIGHTINGALE ROSE
    if chart_type in ("donut", "rose"):
        pie_data = [
            {
                "name": str(r.get(x_col, f"Item {i + 1}")),
                "value": round(float(r.get(primary_y, 0) or 0), 2),
            }
            for i, r in enumerate(rows[:12])
        ]
        return {
            "color": BRAND_PALETTE,
            "tooltip": base_tooltip,
            "legend": {
                "orient": "vertical",
                "right": 8,
                "top": "middle",
                "textStyle": {"color": "#94a3b8", "fontSize": 11},
            },
            "series": [
                {
                    "name": primary_y.replace("_", " ").title(),
                    "type": "pie",
                    "radius": ["42%", "74%"] if chart_type == "donut" else ["22%", "76%"],
                    "center": ["38%", "52%"],
                    "roseType": "area" if chart_type == "rose" else False,
                    "itemStyle": {
                        "borderRadius": 6,
                        "borderColor": "#0f172a",
                        "borderWidth": 2,
                    },
                    "label": {"show": False},
                    "emphasis": {
                        "label": {"show": True, "fontSize": 13, "fontWeight": "bold", "color": "#f8fafc"}
                    },
                    "data": pie_data,
                }
            ],
        }

    # 2. FUNNEL CONVERSION
    if chart_type == "funnel":
        funnel_data = [
            {
                "name": str(r.get(x_col, f"Stage {i + 1}")),
                "value": round(float(r.get(primary_y, 0) or 0), 2),
            }
            for i, r in enumerate(rows[:10])
        ]
        return {
            "color": BRAND_PALETTE,
            "tooltip": base_tooltip,
            "legend": {"bottom": 0, "textStyle": {"color": "#94a3b8", "fontSize": 11}},
            "series": [
                {
                    "name": primary_y.replace("_", " ").title(),
                    "type": "funnel",
                    "left": "10%",
                    "top": 16,
                    "bottom": 36,
                    "width": "80%",
                    "sort": "descending",
                    "gap": 4,
                    "label": {"show": True, "position": "inside", "color": "#fff", "fontSize": 11},
                    "itemStyle": {"borderColor": "#0f172a", "borderWidth": 1, "borderRadius": 4},
                    "data": funnel_data,
                }
            ],
        }

    # 3. RADAR MULTI-DIMENSIONAL
    if chart_type == "radar":
        indicators = []
        for r in rows[:8]:
            val = float(r.get(primary_y, 0) or 0)
            indicators.append({"name": str(r.get(x_col, "")), "max": max(val * 1.25, 10)})
        series_items = [
            {
                "value": [round(float(r.get(col, 0) or 0), 2) for r in rows[:8]],
                "name": col.replace("_", " ").title(),
                "areaStyle": {"opacity": 0.25},
            }
            for col in y_cols[:2]
        ]
        return {
            "color": BRAND_PALETTE,
            "tooltip": {"trigger": "item", **base_tooltip},
            "legend": {"bottom": 0, "textStyle": {"color": "#94a3b8", "fontSize": 11}},
            "radar": {
                "indicator": indicators,
                "radius": "64%",
                "splitArea": {"areaStyle": {"color": ["rgba(30,41,59,0.4)", "rgba(15,23,42,0.4)"]}},
                "axisName": {"color": "#cbd5e1", "fontSize": 11},
                "splitLine": {"lineStyle": {"color": "rgba(148,163,184,0.2)"}},
            },
            "series": [{"type": "radar", "data": series_items}],
        }

    # 4. TREEMAP HIERARCHY
    if chart_type == "treemap":
        tree_data = [
            {
                "name": str(r.get(x_col, f"Node {i + 1}")),
                "value": round(float(r.get(primary_y, 0) or 0), 2),
            }
            for i, r in enumerate(rows[:20])
        ]
        return {
            "color": BRAND_PALETTE,
            "tooltip": base_tooltip,
            "series": [
                {
                    "type": "treemap",
                    "roam": False,
                    "breadcrumb": {"show": False},
                    "itemStyle": {"borderColor": "#0f172a", "borderWidth": 2, "gapWidth": 2, "borderRadius": 6},
                    "label": {"show": True, "formatter": "{b}\n{c}", "fontSize": 12},
                    "data": tree_data,
                }
            ],
        }

    # 5. SANKEY FLOW
    if chart_type == "sankey":
        # Find two string columns and one numeric column if possible
        str_cols = [c for c in rows[0].keys() if isinstance(rows[0].get(c), str)]
        src_col = str_cols[0] if str_cols else x_col
        tgt_col = str_cols[1] if len(str_cols) > 1 else (y_cols[0] if len(y_cols) > 1 else src_col)
        val_col = primary_y
        nodes_set: set[str] = set()
        links: list[dict[str, Any]] = []
        for r in rows[:30]:
            s_val = f"{r.get(src_col, 'Source')}"
            t_val = f"{r.get(tgt_col, 'Target')}"
            if s_val == t_val:
                t_val = f"{t_val} (Out)"
            v_num = round(float(r.get(val_col, 0) or 0), 2)
            if v_num > 0:
                nodes_set.add(s_val)
                nodes_set.add(t_val)
                links.append({"source": s_val, "target": t_val, "value": v_num})
        return {
            "color": BRAND_PALETTE,
            "tooltip": {"trigger": "item", **base_tooltip},
            "series": [
                {
                    "type": "sankey",
                    "emphasis": {"focus": "adjacency"},
                    "nodeAlign": "left",
                    "data": [{"name": n} for n in sorted(nodes_set)],
                    "links": links,
                    "lineStyle": {"color": "gradient", "curveness": 0.5, "opacity": 0.45},
                    "label": {"color": "#e2e8f0", "fontSize": 11},
                }
            ],
        }

    # 6. HEATMAP MATRIX
    if chart_type == "heatmap":
        str_cols = [c for c in rows[0].keys() if isinstance(rows[0].get(c), str)]
        dim_x = str_cols[0] if str_cols else x_col
        dim_y = str_cols[1] if len(str_cols) > 1 else dim_x
        x_vals = list(dict.fromkeys(str(r.get(dim_x, "")) for r in rows))[:16]
        y_vals = list(dict.fromkeys(str(r.get(dim_y, "")) for r in rows))[:12]
        heat_data = []
        max_v = 1.0
        for r in rows:
            xv = str(r.get(dim_x, ""))
            yv = str(r.get(dim_y, ""))
            if xv in x_vals and yv in y_vals:
                val = round(float(r.get(primary_y, 0) or 0), 2)
                max_v = max(max_v, val)
                heat_data.append([x_vals.index(xv), y_vals.index(yv), val])
        return {
            "tooltip": {"position": "top", **base_tooltip},
            "grid": {"top": 20, "bottom": 50, "left": 85, "right": 24},
            "xAxis": {"type": "category", "data": x_vals, "axisLabel": {"color": "#94a3b8", "fontSize": 10}},
            "yAxis": {"type": "category", "data": y_vals, "axisLabel": {"color": "#94a3b8", "fontSize": 10}},
            "visualMap": {
                "min": 0,
                "max": max_v,
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": 0,
                "inRange": {"color": ["#1e1b4b", "#4f46e5", "#06b6d4", "#10b981"]},
                "textStyle": {"color": "#94a3b8", "fontSize": 10},
            },
            "series": [
                {
                    "name": primary_y.replace("_", " ").title(),
                    "type": "heatmap",
                    "data": heat_data,
                    "label": {"show": len(heat_data) <= 48, "color": "#f8fafc", "fontSize": 10},
                }
            ],
        }

    # 7. SCATTER CORRELATION
    if chart_type == "scatter":
        sec_col = secondary_y or primary_y
        pts = [
            [
                round(float(r.get(primary_y, 0) or 0), 2),
                round(float(r.get(sec_col, 0) or 0), 2),
                str(r.get(x_col, "")),
            ]
            for r in rows
        ]
        return {
            "color": BRAND_PALETTE,
            "tooltip": {
                "trigger": "item",
                **base_tooltip,
            },
            "grid": {"top": 28, "right": 24, "bottom": 38, "left": 56, "containLabel": True},
            "xAxis": {
                "type": "value",
                "name": primary_y.replace("_", " ").title(),
                "nameLocation": "middle",
                "nameGap": 25,
                "axisLabel": {"color": "#94a3b8", "fontSize": 11},
                "splitLine": {"lineStyle": {"color": "rgba(148,163,184,0.12)", "type": "dashed"}},
            },
            "yAxis": {
                "type": "value",
                "name": sec_col.replace("_", " ").title(),
                "axisLabel": {"color": "#94a3b8", "fontSize": 11},
                "splitLine": {"lineStyle": {"color": "rgba(148,163,184,0.12)", "type": "dashed"}},
            },
            "series": [
                {
                    "name": f"{primary_y} vs {sec_col}",
                    "type": "scatter",
                    "symbolSize": 12,
                    "itemStyle": {"color": "#06b6d4", "opacity": 0.85, "shadowBlur": 8, "shadowColor": "rgba(6, 182, 212, 0.4)"},
                    "data": pts,
                }
            ],
        }

    # 8. HORIZONTAL RANKING BAR
    if chart_type == "horizontal_bar":
        top_rows = list(reversed(rows[:12]))
        cats = [str(r.get(x_col, f"#{i + 1}")) for i, r in enumerate(top_rows)]
        vals = [round(float(r.get(primary_y, 0) or 0), 2) for r in top_rows]
        return {
            "color": BRAND_PALETTE,
            "tooltip": base_tooltip,
            "grid": {"top": 16, "right": 32, "bottom": 24, "left": 16, "containLabel": True},
            "xAxis": {
                "type": "value",
                "axisLabel": {"color": "#94a3b8", "fontSize": 11},
                "splitLine": {"lineStyle": {"color": "rgba(148,163,184,0.12)", "type": "dashed"}},
            },
            "yAxis": {
                "type": "category",
                "data": cats,
                "axisLabel": {"color": "#cbd5e1", "fontSize": 11, "width": 110, "overflow": "truncate"},
                "axisLine": {"lineStyle": {"color": "rgba(148,163,184,0.2)"}},
            },
            "series": [
                {
                    "name": primary_y.replace("_", " ").title(),
                    "type": "bar",
                    "data": vals,
                    "barMaxWidth": 22,
                    "itemStyle": {
                        "borderRadius": [0, 6, 6, 0],
                        "color": {
                            "type": "linear",
                            "x": 0,
                            "y": 0,
                            "x2": 1,
                            "y2": 0,
                            "colorStops": [
                                {"offset": 0, "color": "#4f46e5"},
                                {"offset": 1, "color": "#06b6d4"},
                            ],
                        },
                    },
                }
            ],
        }

    # 9. STANDARD / DUAL-AXIS / AREA / LINE / STACKED / GROUPED BAR
    has_zoom = len(categories) > 10
    series_list: list[dict[str, Any]] = []
    y_axes: list[dict[str, Any]] = [
        {
            "type": "value",
            "axisLabel": {"color": "#94a3b8", "fontSize": 11},
            "splitLine": {"lineStyle": {"color": "rgba(148,163,184,0.12)", "type": "dashed"}},
        }
    ]

    if chart_type == "combo_dual_axis" and secondary_y:
        y_axes.append(
            {
                "type": "value",
                "axisLabel": {"color": "#10b981", "fontSize": 11},
                "splitLine": {"show": False},
            }
        )
        series_list.append(
            {
                "name": primary_y.replace("_", " ").title(),
                "type": "bar",
                "barMaxWidth": 28,
                "itemStyle": {"borderRadius": [5, 5, 0, 0], "color": "#6366f1"},
                "data": [round(float(r.get(primary_y, 0) or 0), 2) for r in rows],
            }
        )
        series_list.append(
            {
                "name": secondary_y.replace("_", " ").title(),
                "type": "line",
                "yAxisIndex": 1,
                "smooth": True,
                "symbol": "circle",
                "symbolSize": 7,
                "lineStyle": {"width": 3, "color": "#10b981"},
                "itemStyle": {"color": "#10b981"},
                "data": [round(float(r.get(secondary_y, 0) or 0), 2) for r in rows],
            }
        )
    else:
        for idx, col in enumerate(y_cols[:3]):
            color = BRAND_PALETTE[idx % len(BRAND_PALETTE)]
            is_line = chart_type in ("area_spline", "multi_line")
            s_obj: dict[str, Any] = {
                "name": col.replace("_", " ").title(),
                "type": "line" if is_line else "bar",
                "data": [round(float(r.get(col, 0) or 0), 2) for r in rows],
                "itemStyle": {"color": color},
            }
            if is_line:
                s_obj["smooth"] = True
                s_obj["symbolSize"] = 6
                s_obj["lineStyle"] = {"width": 3, "color": color}
                if chart_type == "area_spline":
                    s_obj["areaStyle"] = {
                        "color": {
                            "type": "linear",
                            "x": 0,
                            "y": 0,
                            "x2": 0,
                            "y2": 1,
                            "colorStops": [
                                {"offset": 0, "color": color + "88"},
                                {"offset": 1, "color": color + "05"},
                            ],
                        }
                    }
            else:
                s_obj["barMaxWidth"] = 30
                s_obj["itemStyle"]["borderRadius"] = [5, 5, 0, 0]
                if chart_type == "stacked_bar":
                    s_obj["stack"] = "total"
            series_list.append(s_obj)

        # If a moving average column exists on a single-metric area_spline, overlay a subtle dashed trendline
        ma_col = f"{primary_y}_ma3"
        if chart_type == "area_spline" and len(y_cols) == 1 and rows and ma_col in rows[0] and len(rows) >= 6:
            series_list.append(
                {
                    "name": "3-Period Moving Avg",
                    "type": "line",
                    "smooth": True,
                    "symbol": "none",
                    "lineStyle": {"width": 2, "type": "dashed", "color": "#f59e0b"},
                    "itemStyle": {"color": "#f59e0b"},
                    "data": [r.get(ma_col) for r in rows],
                }
            )

    option: dict[str, Any] = {
        "color": BRAND_PALETTE,
        "tooltip": base_tooltip,
        "legend": {
            "top": 0,
            "right": 8,
            "textStyle": {"color": "#94a3b8", "fontSize": 11},
        },
        "grid": {
            "top": 34,
            "right": 24 if len(y_axes) == 1 else 48,
            "bottom": 46 if has_zoom else 24,
            "left": 16,
            "containLabel": True,
        },
        "xAxis": {
            "type": "category",
            "data": categories,
            "boundaryGap": chart_type not in ("area_spline", "multi_line"),
            "axisLabel": {"color": "#94a3b8", "fontSize": 11},
            "axisLine": {"lineStyle": {"color": "rgba(148,163,184,0.2)"}},
        },
        "yAxis": y_axes if len(y_axes) > 1 else y_axes[0],
        "series": series_list,
    }

    if has_zoom:
        option["dataZoom"] = [
            {"type": "inside", "start": 0, "end": 100},
            {
                "type": "slider",
                "height": 16,
                "bottom": 6,
                "borderColor": "rgba(148,163,184,0.15)",
                "fillerColor": "rgba(99, 102, 241, 0.2)",
                "textStyle": {"color": "#94a3b8", "fontSize": 10},
            },
        ]

    return option


def compute_responsive_grid_layout(
    widgets: list[DashboardWidgetSpec],
    preset: str = "executive",
) -> dict[str, list[GridCoordinates]]:
    """
    Computes 12-column (`lg`), 8-column (`md`), and 4-column (`sm`) `react-grid-layout` coordinates
    based on semantic widget hierarchy:
    - Tier 1: KPI metric cards across the top row
    - Tier 2: Hero time-series / dual-axis chart (8 cols) + proportional donut/funnel/radar (4 cols)
    - Tier 3: Secondary analytical charts (6 cols each)
    - Tier 4: Full-width interactive Data Explorer Table (12 cols)
    """
    kpis = [w for w in widgets if w.widget_type == "kpi"]
    charts = [w for w in widgets if w.widget_type == "echarts"]
    tables = [w for w in widgets if w.widget_type == "table"]

    lg_coords: list[GridCoordinates] = []
    md_coords: list[GridCoordinates] = []
    sm_coords: list[GridCoordinates] = []

    curr_y_lg = 0
    curr_y_md = 0
    curr_y_sm = 0

    # 1. Pack KPI Row
    if kpis:
        kpi_w_lg = max(3, 12 // max(1, min(len(kpis), 4)))
        for idx, w in enumerate(kpis):
            col_idx = idx % 4
            if idx > 0 and col_idx == 0:
                curr_y_lg += 3
            lg_coords.append(GridCoordinates(i=w.id, x=col_idx * kpi_w_lg, y=curr_y_lg, w=kpi_w_lg, h=3, minW=2, minH=3))
            md_coords.append(GridCoordinates(i=w.id, x=(idx % 2) * 4, y=curr_y_md + (idx // 2) * 3, w=4, h=3, minW=2, minH=3))
            sm_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_sm, w=4, h=3, minW=2, minH=3))
            curr_y_sm += 3
        curr_y_lg += 3
        curr_y_md += ((len(kpis) + 1) // 2) * 3

    # 2. Pack Charts
    if preset == "compact":
        for idx, w in enumerate(charts):
            col_idx = idx % 3
            lg_coords.append(GridCoordinates(i=w.id, x=col_idx * 4, y=curr_y_lg + (idx // 3) * 7, w=4, h=7, minW=3, minH=5))
            md_coords.append(GridCoordinates(i=w.id, x=(idx % 2) * 4, y=curr_y_md + (idx // 2) * 7, w=4, h=7, minW=3, minH=5))
            sm_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_sm, w=4, h=7, minW=2, minH=5))
            curr_y_sm += 7
        curr_y_lg += ((len(charts) + 2) // 3) * 7
        curr_y_md += ((len(charts) + 1) // 2) * 7
    else:
        # Executive / Bento hierarchy
        for idx, w in enumerate(charts):
            if idx == 0 and len(charts) >= 2:
                # Primary Hero Chart (8 cols)
                lg_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_lg, w=8, h=8, minW=4, minH=6))
            elif idx == 1 and len(charts) >= 2:
                # Companion Breakdown Chart (4 cols)
                lg_coords.append(GridCoordinates(i=w.id, x=8, y=curr_y_lg, w=4, h=8, minW=3, minH=6))
                curr_y_lg += 8
            else:
                rem_idx = idx - 2 if len(charts) >= 2 else idx
                is_last_odd = (idx == len(charts) - 1) and (rem_idx % 2 == 0)
                w_span = 12 if is_last_odd and len(charts) == 1 else (12 if is_last_odd and preset == "bento" else 6)
                x_pos = 0 if w_span == 12 else (rem_idx % 2) * 6
                lg_coords.append(GridCoordinates(i=w.id, x=x_pos, y=curr_y_lg, w=w_span, h=8, minW=4, minH=6))
                if x_pos == 6 or w_span == 12 or idx == len(charts) - 1:
                    curr_y_lg += 8

            md_coords.append(GridCoordinates(i=w.id, x=(idx % 2) * 4, y=curr_y_md + (idx // 2) * 8, w=4, h=8, minW=4, minH=6))
            sm_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_sm, w=4, h=8, minW=4, minH=6))
            curr_y_sm += 8

        curr_y_md += ((len(charts) + 1) // 2) * 8

    # 3. Pack Data Explorer Tables at Bottom
    for w in tables:
        lg_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_lg, w=12, h=8, minW=6, minH=5))
        md_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_md, w=8, h=8, minW=4, minH=5))
        sm_coords.append(GridCoordinates(i=w.id, x=0, y=curr_y_sm, w=4, h=8, minW=4, minH=5))
        curr_y_lg += 8
        curr_y_md += 8
        curr_y_sm += 8

    return {"lg": lg_coords, "md": md_coords, "sm": sm_coords}
