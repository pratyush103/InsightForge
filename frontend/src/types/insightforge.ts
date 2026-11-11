export type SQLDialectType = 'sqlite' | 'mysql' | 'mssql';

export interface RecommendedModelSpec {
  id: string;
  name: string;
  tag: string;
  category: string;
  size_gb: number;
  min_ram_gb: number;
  description: string;
  strengths: string[];
  recommended_for: string;
  is_installed: boolean;
  is_top_pick: boolean;
}

export interface InstalledModelInfo {
  name: string;
  size_gb: number;
  family: string;
  parameter_size: string;
  quantization_level: string;
  modified_at: string;
  is_running: boolean;
}

export interface OllamaSystemStatus {
  status: 'running' | 'installed_stopped' | 'not_installed';
  base_url: string;
  binary_path: string | null;
  cli_version: string | null;
  os_platform: string;
  installed_models: InstalledModelInfo[];
  selected_model: string | null;
  recommended_models: RecommendedModelSpec[];
  action_required: 'none' | 'launch_ollama' | 'install_ollama' | 'pull_model';
  message: string;
  install_guide: {
    windows_installer_url?: string;
    windows_winget_cmd?: string;
    mac_brew_cmd?: string;
    linux_curl_cmd?: string;
    official_site?: string;
    serve_cmd?: string;
  };
}

export interface ColumnProfile {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_target: string | null;
  distinct_count: number | null;
  null_count: number | null;
  min_value: unknown;
  max_value: unknown;
  sample_values: unknown[];
}

export interface TableProfile {
  table_name: string;
  row_count: number;
  columns: ColumnProfile[];
  sample_rows: Record<string, unknown>[];
  description: string;
}

export interface SchemaCatalog {
  connector_id: string;
  connector_name: string;
  dialect: SQLDialectType;
  database_display: string;
  schema_fingerprint: string;
  tables: TableProfile[];
}

export interface ConnectorInfo {
  id: string;
  name: string;
  dialect: SQLDialectType;
  database_display: string;
  is_builtin: boolean;
  status: 'connected' | 'error';
  table_count: number;
  total_rows: number;
  error_message?: string | null;
}

export interface StatisticalAnomaly {
  row_index: number;
  dimension_label: string;
  metric_name: string;
  value: number;
  z_score: number;
  direction: 'spike' | 'drop';
}

export interface PipelineStep {
  step_id: string;
  step_number: number;
  title: string;
  kind: 'sql_extraction' | 'statistical_enrichment';
  sql_query: string | null;
  executed_sql: string | null;
  depends_on: string[];
  operation: string;
  row_count: number;
  columns: string[];
  output_hash: string;
  execution_ms: number;
  anomalies_detected: StatisticalAnomaly[];
  summary_stats: Record<string, unknown>;
}

export interface GridCoordinates {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type ChartArchetype =
  | 'kpi'
  | 'area_spline'
  | 'multi_line'
  | 'grouped_bar'
  | 'stacked_bar'
  | 'horizontal_bar'
  | 'combo_dual_axis'
  | 'donut'
  | 'rose'
  | 'funnel'
  | 'radar'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'sankey'
  | 'geo_map'
  | 'table';

export interface KpiPayload {
  formatted_value: string;
  raw_value: number;
  metric_label: string;
  delta_pct: number;
  delta_direction: 'up' | 'down' | 'neutral';
  sparkline: number[];
  subtext: string;
}

export interface DashboardWidgetSpec {
  id: string;
  title: string;
  subtitle: string;
  widget_type: 'kpi' | 'echarts' | 'table';
  chart_type: ChartArchetype;
  step_id: string;
  sql_query: string;
  data_hash: string;
  columns: string[];
  rows: Record<string, unknown>[];
  x_field: string | null;
  y_fields: string[];
  series_field?: string | null;
  kpi_payload?: KpiPayload | null;
  echarts_option?: Record<string, unknown> | null;
  insight_summary: string;
  anomalies: StatisticalAnomaly[];
}

export interface PipelineManifest {
  pipeline_id: string;
  title: string;
  user_query: string;
  created_at: string;
  last_replayed_at: string | null;
  connector_id: string;
  connector_name: string;
  dialect: SQLDialectType;
  schema_fingerprint: string;
  model_used: string;
  steps: PipelineStep[];
  widgets: DashboardWidgetSpec[];
  layouts: Record<string, GridCoordinates[]>;
  executive_summary: string;
  key_insights: string[];
  suggested_followups: string[];
  reproducibility_verified: boolean;
  data_drifted: boolean;
}

export interface PipelineSummaryItem {
  pipeline_id: string;
  title: string;
  user_query: string;
  created_at: string;
  last_replayed_at: string | null;
  connector_id: string;
  connector_name: string;
  dialect: SQLDialectType;
  schema_fingerprint: string;
  model_used: string;
  widget_count: number;
  step_count: number;
  reproducibility_verified: boolean;
}

export interface AgentTraceEvent {
  agent: string;
  status: 'running' | 'completed' | 'warning' | 'error';
  title: string;
  detail: string;
  duration_ms: number;
}

export interface CrossFilterState {
  column: string;
  value: string;
  sourceWidgetId: string;
}
