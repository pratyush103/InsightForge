import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  FileSpreadsheet,
  Filter,
  Hash,
  Key,
  Layers,
  Link2,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ChartArchetype, ColumnProfile } from '../../types/insightforge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';

interface UnifiedTableItem {
  tableName: string;
  source: 'SQL' | 'CSV';
  dialectLabel: string;
  rowCount: number;
  columns: ColumnProfile[];
}

const CHART_TYPE_OPTIONS: { id: ChartArchetype; label: string }[] = [
  { id: 'area_spline', label: 'Area Spline' },
  { id: 'multi_line', label: 'Multi-Line' },
  { id: 'grouped_bar', label: 'Grouped Bar' },
  { id: 'stacked_bar', label: 'Stacked Bar' },
  { id: 'horizontal_bar', label: 'Horizontal Rank' },
  { id: 'combo_dual_axis', label: 'Combo Dual-Axis' },
  { id: 'donut', label: 'Donut' },
  { id: 'rose', label: 'Nightingale Rose' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'sankey', label: 'Sankey Flow' },
  { id: 'radar', label: 'Radar' },
  { id: 'treemap', label: 'Treemap' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'geo_map', label: 'Geo Map' },
];

function formatDataTypeBadge(rawType: string): string {
  const upper = (rawType || 'TEXT').toUpperCase();
  if (upper.includes('INT')) return 'INT';
  if (upper.includes('CHAR') || upper.includes('TEXT') || upper.includes('CLOB')) return 'VARCHAR';
  if (upper.includes('DEC') || upper.includes('NUM') || upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) {
    return 'DECIMAL';
  }
  if (upper.includes('DATE') || upper.includes('TIME')) return 'DATE';
  if (upper.includes('BOOL')) return 'BOOL';
  return upper.slice(0, 8);
}

export const DataModelerSidebar: React.FC = () => {
  const {
    projects,
    activeProjectId,
    selectedWidgetId,
    setSelectedWidgetId,
    setDataSourceModalOpen,
    setERDiagramModalOpen,
    removeVirtualRelation,
    updateWidgetScope,
  } = useProjectStore();

  const {
    schemaCatalog: storeSchemaCatalog,
    manifest,
    setEditingWidget,
    mutateWidget,
  } = useDashboardStore();

  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // Collapsed by default as requested
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'model' | 'properties'>('model');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Active page & selected widget
  const activePage = useMemo(() => {
    if (!project) return null;
    return (
      project.pages.find((pg) => pg.id === project.activePageId) ||
      project.pages[0] ||
      null
    );
  }, [project]);

  const allWidgets = useMemo(() => {
    if (activePage?.widgets && activePage.widgets.length > 0) {
      return activePage.widgets;
    }
    if (manifest?.widgets && manifest.widgets.length > 0 && project?.manifest) {
      return manifest.widgets;
    }
    return [];
  }, [activePage, manifest, project]);

  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null;
    return allWidgets.find((w) => w.id === selectedWidgetId) || null;
  }, [allWidgets, selectedWidgetId]);

  const selectedWidgetScope = useMemo(() => {
    if (!activePage || !selectedWidget) return undefined;
    return activePage.widgetScopes?.[selectedWidget.id];
  }, [activePage, selectedWidget]);

  // When a widget is selected on the canvas, reveal and focus the Properties tab
  useEffect(() => {
    if (selectedWidget) {
      setActiveTab('properties');
      setIsCollapsed(false);
    }
  }, [selectedWidget?.id]);

  // If no widget is selected, switch activeTab back to model if it was on properties
  useEffect(() => {
    if (!selectedWidget && activeTab === 'properties') {
      setActiveTab('model');
    }
  }, [selectedWidget, activeTab]);

  // Unified tables list (SQL tables + CSV tables)
  const unifiedTables = useMemo<UnifiedTableItem[]>(() => {
    const list: UnifiedTableItem[] = [];
    const sqlTables =
      project?.schemaCatalog?.tables || storeSchemaCatalog?.tables || [];
    const dialectLabel =
      project?.schemaCatalog?.dialect?.toUpperCase() ||
      storeSchemaCatalog?.dialect?.toUpperCase() ||
      'SQL';

    for (const t of sqlTables) {
      list.push({
        tableName: t.table_name,
        source: 'SQL',
        dialectLabel,
        rowCount: t.row_count,
        columns: t.columns,
      });
    }

    if (project?.embeddedCsvTables) {
      for (const csv of project.embeddedCsvTables) {
        const dummyCols: ColumnProfile[] = csv.columns.map((c, i) => ({
          name: c,
          data_type: 'VARCHAR',
          nullable: true,
          is_primary_key: i === 0 && (c.toLowerCase().includes('id') || c.toLowerCase().endsWith('_id')),
          is_foreign_key: i > 0 && (c.toLowerCase().includes('id') || c.toLowerCase().endsWith('_id')),
          foreign_key_target: null,
          distinct_count: null,
          null_count: null,
          min_value: null,
          max_value: null,
          sample_values: [],
        }));

        list.push({
          tableName: csv.tableName,
          source: 'CSV',
          dialectLabel: 'CSV',
          rowCount: csv.rowCount,
          columns: dummyCols,
        });
      }
    }

    return list;
  }, [project?.schemaCatalog, storeSchemaCatalog, project?.embeddedCsvTables]);

  const virtualRelations = useMemo(() => {
    return project?.virtualRelations || [];
  }, [project?.virtualRelations]);

  const physicalForeignKeys = useMemo(() => {
    const fks: Array<{
      id: string;
      sourceTable: string;
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
    }> = [];

    for (const t of unifiedTables) {
      for (const col of t.columns) {
        if (col.is_foreign_key && col.foreign_key_target) {
          const [targetTable, targetColumn] = col.foreign_key_target.split('.');
          if (targetTable && targetColumn) {
            fks.push({
              id: `fk-${t.tableName}.${col.name}->${targetTable}.${targetColumn}`,
              sourceTable: t.tableName,
              sourceColumn: col.name,
              targetTable,
              targetColumn,
            });
          }
        }
      }
    }
    return fks;
  }, [unifiedTables]);

  const isColumnInVirtualRelation = (tableName: string, colName: string): boolean => {
    return virtualRelations.some(
      (r) =>
        (r.sourceTable === tableName && r.sourceColumn === colName) ||
        (r.targetTable === tableName && r.targetColumn === colName)
    );
  };

  const filteredTables = useMemo(() => {
    if (!searchFilter.trim()) return unifiedTables;
    const q = searchFilter.toLowerCase();
    return unifiedTables.filter(
      (t) =>
        t.tableName.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [unifiedTables, searchFilter]);

  const toggleTableExpanded = (tName: string) => {
    setExpandedTables((prev) => ({ ...prev, [tName]: !prev[tName] }));
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full shrink-0 select-none">
        {/* EXPANDED INDEPENDENT PANEL (renders when not collapsed) */}
        {!isCollapsed && (
          <aside className="w-80 border-l border-slate-800/60 bg-slate-950 flex flex-col h-full overflow-hidden">
            {/* DATA MODEL PANEL */}
            {activeTab === 'model' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/30">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-100 tracking-tight">Data Model</span>
                    <span className="rounded-md bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                      {unifiedTables.length} {unifiedTables.length === 1 ? 'table' : 'tables'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setERDiagramModalOpen(true)}
                          aria-label="Visualise"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-indigo-300 transition"
                        >
                          <Network className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-medium">
                        Visualise
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setDataSourceModalOpen(true)}
                          aria-label="Add Data Source"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-medium">
                        Add Data Source
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsCollapsed(true)}
                          aria-label="Collapse panel"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition"
                        >
                          <PanelRightClose className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-medium">
                        Collapse
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Empty State when project has zero tables */}
                {unifiedTables.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-full rounded-xl border border-slate-800/60 bg-slate-900/25 p-5 space-y-3">
                      <div className="mx-auto h-9 w-9 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-500">
                        <Database className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-slate-200">No Data Sources Connected</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Connect a SQL database (SQLite, MySQL, MS SQL) or import flat CSV files to build your semantic model.
                        </p>
                      </div>
                      <button
                        onClick={() => setDataSourceModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition"
                      >
                        <Plus className="h-3.5 w-3.5" /> Connect Data
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Bar */}
                    <div className="p-2.5 border-b border-slate-800/60">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          placeholder="Filter tables or columns..."
                          className="w-full rounded-md border border-slate-800 bg-slate-900/70 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Tables Tree */}
                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-1">
                        {filteredTables.map((table) => {
                          const isOpen = expandedTables[table.tableName] ?? false;
                          return (
                            <div
                              key={table.tableName}
                              className="rounded-lg border border-slate-800/60 bg-slate-900/20 overflow-hidden"
                            >
                              <button
                                onClick={() => toggleTableExpanded(table.tableName)}
                                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-slate-900/50 transition text-left"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  )}
                                  {table.source === 'CSV' ? (
                                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Table2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-slate-200 truncate">
                                    {table.tableName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase ${
                                      table.source === 'CSV'
                                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                                    }`}
                                  >
                                    {table.source}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {table.rowCount.toLocaleString()}
                                  </span>
                                </div>
                              </button>

                              {isOpen && (
                                <div className="border-t border-slate-800/50 bg-slate-950/50 py-1 px-2 space-y-0.5">
                                  {table.columns.map((col) => {
                                    const isVirtFk = isColumnInVirtualRelation(table.tableName, col.name);
                                    const isFk = col.is_foreign_key || isVirtFk;
                                    return (
                                      <div
                                        key={col.name}
                                        className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-900/50 text-[11px]"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {col.is_primary_key ? (
                                            <Key
                                              className="h-3 w-3 text-amber-400 shrink-0"
                                              aria-label="Primary Key"
                                            />
                                          ) : isFk ? (
                                            <Link2
                                              className="h-3 w-3 text-indigo-400 shrink-0"
                                              aria-label="Foreign Key"
                                            />
                                          ) : (
                                            <span className="w-3 shrink-0 inline-block text-center text-slate-600">
                                              ·
                                            </span>
                                          )}
                                          <span
                                            className={`truncate font-mono ${
                                              col.is_primary_key
                                                ? 'text-slate-100 font-medium'
                                                : isFk
                                                ? 'text-indigo-200'
                                                : 'text-slate-300'
                                            }`}
                                          >
                                            {col.name}
                                          </span>
                                        </div>

                                        <span className="rounded bg-slate-900 border border-slate-800/70 px-1.5 py-0.2 text-[9px] font-mono text-slate-400 shrink-0">
                                          {formatDataTypeBadge(col.data_type)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    {/* Relations Summary Section */}
                    <div className="border-t border-slate-800/60 bg-slate-900/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-[11px] font-medium text-slate-300">
                            Model Relationships
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({physicalForeignKeys.length + virtualRelations.length})
                          </span>
                        </div>

                        <button
                          onClick={() => setERDiagramModalOpen(true)}
                          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Visualise ER →
                        </button>
                      </div>

                      <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                        {physicalForeignKeys.length === 0 && virtualRelations.length === 0 ? (
                          <p className="text-[11px] text-slate-500">
                            No active table relationships declared.
                          </p>
                        ) : (
                          <>
                            {virtualRelations.map((rel) => (
                              <div
                                key={rel.id}
                                className="flex items-center justify-between gap-1.5 rounded border border-slate-800/70 bg-slate-950/60 px-2 py-1 text-[10px] font-mono text-slate-300"
                              >
                                <span className="truncate">
                                  {rel.sourceTable}.{rel.sourceColumn}{' '}
                                  <span className="text-indigo-400">→</span> {rel.targetTable}.{rel.targetColumn}
                                </span>
                                {project && (
                                  <button
                                    onClick={() => removeVirtualRelation(project.id, rel.id)}
                                    title="Remove virtual relation"
                                    className="text-slate-500 hover:text-rose-400 transition shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {physicalForeignKeys.map((fk) => (
                              <div
                                key={fk.id}
                                className="flex items-center justify-between gap-1.5 rounded border border-slate-800/50 bg-slate-950/40 px-2 py-1 text-[10px] font-mono text-slate-400"
                              >
                                <span className="truncate">
                                  {fk.sourceTable}.{fk.sourceColumn} → {fk.targetTable}.{fk.targetColumn}
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase shrink-0">FK</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VISUAL PROPERTIES PANEL (renders when activeTab === 'properties' and widget is selected) */}
            {activeTab === 'properties' && selectedWidget && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <SlidersHorizontal className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-100 tracking-tight">Visual Properties</span>
                    <span className="rounded-md bg-indigo-500/10 border border-indigo-500/25 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300 shrink-0 uppercase">
                      {selectedWidget.chart_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedWidgetId(null)}
                          aria-label="Deselect visual"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-medium">
                        Deselect Visual
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsCollapsed(true)}
                          aria-label="Collapse panel"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition"
                        >
                          <PanelRightClose className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-medium">
                        Collapse
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Properties Content */}
                <ScrollArea className="flex-1">
                  <div className="p-3.5 space-y-4">
                    {/* Selected Visual Identity */}
                    <div className="rounded-lg border border-slate-800/70 bg-slate-900/30 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
                            {selectedWidget.widget_type} visual
                          </span>
                          <h4 className="text-xs font-medium text-slate-100 mt-0.5">
                            {selectedWidget.title}
                          </h4>
                        </div>
                        <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shrink-0">
                          {selectedWidget.rows.length} rows
                        </span>
                      </div>
                      {selectedWidget.subtitle && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {selectedWidget.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Chart Archetype Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-300">
                        Chart Archetype
                      </label>
                      {selectedWidget.widget_type === 'echarts' ? (
                        <select
                          value={selectedWidget.chart_type}
                          onChange={(e) =>
                            mutateWidget(selectedWidget, {
                              newChartType: e.target.value as ChartArchetype,
                            })
                          }
                          className="w-full rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                        >
                          {CHART_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-md border border-slate-800/70 bg-slate-900/40 px-2.5 py-1.5 text-xs font-mono text-slate-300">
                          {selectedWidget.chart_type.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Active Scope / Slice State */}
                    <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                          <Filter className="h-3 w-3 text-indigo-400" />
                          Widget Scope & Window
                        </span>
                        {project && selectedWidgetScope && (
                          <button
                            onClick={() =>
                              updateWidgetScope(project.id, selectedWidget.id, {
                                dateRange: undefined,
                                selectedCategory: undefined,
                                zoomStart: 0,
                                zoomEnd: 100,
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-slate-200 transition"
                          >
                            Reset Scope
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Row Window Slice (Top N / Zoom %)
                          </label>
                          <select
                            value={String(selectedWidgetScope?.zoomEnd ?? 100)}
                            onChange={(e) => {
                              if (!project) return;
                              updateWidgetScope(project.id, selectedWidget.id, {
                                zoomStart: 0,
                                zoomEnd: Number(e.target.value),
                              });
                            }}
                            className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="100">All Records (100%)</option>
                            <option value="75">First 75% Window</option>
                            <option value="50">First 50% Window</option>
                            <option value="25">Top 25% Window</option>
                          </select>
                        </div>

                        {selectedWidget.x_field && selectedWidget.rows.length > 0 && (
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Pin Category Slice ({selectedWidget.x_field})
                            </label>
                            <select
                              value={selectedWidgetScope?.selectedCategory || ''}
                              onChange={(e) => {
                                if (!project) return;
                                updateWidgetScope(project.id, selectedWidget.id, {
                                  selectedCategory: e.target.value || undefined,
                                });
                              }}
                              className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="">All Categories</option>
                              {Array.from(
                                new Set(
                                  selectedWidget.rows
                                    .map((r) => String(r[selectedWidget.x_field!] ?? ''))
                                    .filter(Boolean)
                                )
                              )
                                .slice(0, 25)
                                .map((val) => (
                                  <option key={val} value={val}>
                                    {val}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lineage & Field Mapping Metadata */}
                    <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/30 p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                        <Hash className="h-3 w-3 text-slate-400" />
                        Data Lineage & Fields
                      </div>
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>SHA-256 Hash</span>
                          <code className="font-mono text-[10px] text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {selectedWidget.data_hash.slice(0, 16)}
                          </code>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Pipeline Step</span>
                          <code className="font-mono text-[10px] text-slate-300">
                            {selectedWidget.step_id}
                          </code>
                        </div>
                        {selectedWidget.x_field && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Dimension (X)</span>
                            <code className="font-mono text-[10px] text-slate-200">
                              {selectedWidget.x_field}
                            </code>
                          </div>
                        )}
                        {selectedWidget.y_fields.length > 0 && (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Metrics (Y)</span>
                            <code className="font-mono text-[10px] text-slate-200 truncate max-w-[140px]">
                              {selectedWidget.y_fields.join(', ')}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Open SQL & Chart Inspector Action */}
                    <button
                      type="button"
                      onClick={() => setEditingWidget(selectedWidget)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-200 transition"
                    >
                      <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                      Open SQL & Chart Inspector
                    </button>

                    {/* Understated note */}
                    <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/50 pt-3">
                      Granular visual formatting properties, axis bindings, and deterministic scope overrides for the selected visual are managed in this panel.
                    </p>
                  </div>
                </ScrollArea>
              </div>
            )}
          </aside>
        )}

        {/* ALWAYS-VISIBLE 44px ICON RAIL ON THE RIGHT EDGE */}
        <aside className="w-11 shrink-0 border-l border-slate-800/60 bg-slate-950 flex flex-col items-center py-3 gap-3 select-none">
          {/* Top Collapse/Expand Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition"
                aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isCollapsed ? (
                  <PanelRightOpen className="h-4 w-4" />
                ) : (
                  <PanelRightClose className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-slate-900 border-slate-800 text-slate-100 text-xs">
              {isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </TooltipContent>
          </Tooltip>

          {/* Data Model Tab Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (isCollapsed) {
                    setIsCollapsed(false);
                    setActiveTab('model');
                  } else if (activeTab === 'model') {
                    setIsCollapsed(true);
                  } else {
                    setActiveTab('model');
                  }
                }}
                className={`p-1.5 rounded-md transition ${
                  !isCollapsed && activeTab === 'model'
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
                aria-label="Data Model"
              >
                <Layers className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-slate-900 border-slate-800 text-slate-100 text-xs">
              Data Model ({unifiedTables.length})
            </TooltipContent>
          </Tooltip>

          {/* Visualise ER Diagram Action Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setERDiagramModalOpen(true)}
                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-900 transition"
                aria-label="Visualise"
              >
                <Network className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-slate-900 border-slate-800 text-slate-100 text-xs">
              Visualise
            </TooltipContent>
          </Tooltip>

          {/* Visual Properties Tab Icon — ONLY APPEARS IF A WIDGET IS SELECTED */}
          {selectedWidget && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (isCollapsed) {
                      setIsCollapsed(false);
                      setActiveTab('properties');
                    } else if (activeTab === 'properties') {
                      setIsCollapsed(true);
                    } else {
                      setActiveTab('properties');
                    }
                  }}
                  className={`relative p-1.5 rounded-md transition ${
                    !isCollapsed && activeTab === 'properties'
                      ? 'bg-slate-800 text-indigo-400 border border-slate-700/80 shadow-sm'
                      : 'text-indigo-400/90 hover:text-indigo-200 hover:bg-slate-900/60'
                  }`}
                  aria-label="Visual Properties"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400 ring-2 ring-indigo-400/30" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-slate-900 border-slate-800 text-slate-100 text-xs">
                Properties ({selectedWidget.title})
              </TooltipContent>
            </Tooltip>
          )}
        </aside>
      </div>
    </TooltipProvider>
  );
};
