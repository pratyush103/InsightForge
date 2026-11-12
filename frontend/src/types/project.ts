import type {
  AgentTraceEvent,
  CrossFilterState,
  DashboardWidgetSpec,
  GridCoordinates,
  PipelineManifest,
  SchemaCatalog,
  SQLDialectType,
  TableProfile,
} from './insightforge';

export interface VirtualRelation {
  id: string;
  name?: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relationType: '1:1' | '1:N' | 'N:1' | 'N:M';
  isVirtual: boolean;
}

export interface EmbeddedCsvTable {
  id: string;
  tableName: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  importedAt: string;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  dialect: SQLDialectType | 'csv';
  connectorId: string;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  selectedTables: string[];
  addedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: string | null;
  agentTraces?: AgentTraceEvent[];
  sqlQueries?: Array<{ title: string; sql: string; rowCount?: number; executionMs?: number }>;
  keyInsights?: string[];
  suggestedFollowups?: string[];
  thoughtSummary?: string;
}

export interface WidgetScopeState {
  dateRange?: string;
  zoomStart?: number;
  zoomEnd?: number;
  selectedCategory?: string;
}

export interface DashboardPageSpec {
  id: string;
  title: string;
  layoutPreset: 'executive' | 'bento' | 'compact';
  widgets: DashboardWidgetSpec[];
  layouts: Record<string, GridCoordinates[]>;
  crossFilter: CrossFilterState | null;
  widgetScopes: Record<string, WidgetScopeState>;
}

export interface InsightForgeProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
  activeConnectorId: string;
  dataSources: DataSourceConfig[];
  embeddedCsvTables: EmbeddedCsvTable[];
  schemaCatalog: SchemaCatalog | null;
  virtualRelations: VirtualRelation[];
  pages: DashboardPageSpec[];
  activePageId: string;
  conversationHistory: ConversationMessage[];
  manifest: PipelineManifest | null;
}

export interface IFPFFileEnvelope {
  format: 'IFPF';
  version: '1.0.0';
  exportedAt: string;
  compressed: boolean;
  project: InsightForgeProject;
}
