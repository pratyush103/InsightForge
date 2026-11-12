import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  Key,
  Link2,
  Maximize2,
  Network,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { ColumnProfile, TableProfile } from '../../types/insightforge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ERTableNode {
  tableName: string;
  source: 'SQL' | 'CSV';
  dialectLabel: string;
  rowCount: number;
  columns: ColumnProfile[];
}

interface NodePosition {
  x: number;
  y: number;
}

interface ERRelationEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relationType: '1:1' | '1:N' | 'N:1' | 'N:M';
  isVirtual: boolean;
}

const CARD_WIDTH = 248;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 26;

function shortDataType(rawType: string): string {
  const upper = (rawType || 'TEXT').toUpperCase();
  if (upper.includes('INT')) return 'INT';
  if (upper.includes('CHAR') || upper.includes('TEXT')) return 'VARCHAR';
  if (upper.includes('DEC') || upper.includes('NUM') || upper.includes('REAL') || upper.includes('FLOAT')) {
    return 'DECIMAL';
  }
  if (upper.includes('DATE') || upper.includes('TIME')) return 'DATE';
  return upper.slice(0, 8);
}

export const ERDiagramModal: React.FC = () => {
  const {
    projects,
    activeProjectId,
    isERDiagramModalOpen,
    setERDiagramModalOpen,
    addVirtualRelation,
    removeVirtualRelation,
  } = useProjectStore();

  const { schemaCatalog: storeSchemaCatalog } = useDashboardStore();

  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // Merge SQL tables and Embedded CSV tables
  const tables = useMemo<ERTableNode[]>(() => {
    if (!project) return [];
    const catalog =
      project.schemaCatalog ?? (project.dataSources.length > 0 ? storeSchemaCatalog : null);
    const sqlTables: TableProfile[] = catalog?.tables || [];
    const csvTables = project.embeddedCsvTables || [];
    const csvNames = new Set(csvTables.map((c) => c.tableName.toLowerCase()));

    const list: ERTableNode[] = [];

    for (const t of sqlTables) {
      const isCsv = csvNames.has(t.table_name.toLowerCase());
      list.push({
        tableName: t.table_name,
        source: isCsv ? 'CSV' : 'SQL',
        dialectLabel: isCsv ? 'CSV' : (catalog?.dialect || 'sqlite').toUpperCase(),
        rowCount: t.row_count,
        columns: t.columns || [],
      });
    }

    for (const csv of csvTables) {
      if (!list.some((it) => it.tableName.toLowerCase() === csv.tableName.toLowerCase())) {
        const cols: ColumnProfile[] = csv.columns.map((cName) => ({
          name: cName,
          data_type: 'VARCHAR',
          nullable: true,
          is_primary_key: cName.toLowerCase() === 'id' || cName.toLowerCase().endsWith('_id'),
          is_foreign_key: false,
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
          columns: cols,
        });
      }
    }

    return list;
  }, [project, storeSchemaCatalog]);

  // Build unified edges (physical foreign keys + virtual relations)
  const edges = useMemo<ERRelationEdge[]>(() => {
    const result: ERRelationEdge[] = [];
    const seenKeys = new Set<string>();

    // Physical FKs from schema
    for (const t of tables) {
      for (const col of t.columns) {
        if (col.is_foreign_key && col.foreign_key_target) {
          const [targetTable, targetColumn] = col.foreign_key_target.split('.');
          if (targetTable && targetColumn) {
            const key = `${t.tableName}.${col.name}->${targetTable}.${targetColumn}`;
            seenKeys.add(key);
            result.push({
              id: `phys-${key}`,
              sourceTable: t.tableName,
              sourceColumn: col.name,
              targetTable,
              targetColumn,
              relationType: 'N:1',
              isVirtual: false,
            });
          }
        }
      }
    }

    // User-declared or seeded virtual relations
    for (const vr of project?.virtualRelations || []) {
      const key = `${vr.sourceTable}.${vr.sourceColumn}->${vr.targetTable}.${vr.targetColumn}`;
      if (!seenKeys.has(key)) {
        result.push({
          id: vr.id,
          sourceTable: vr.sourceTable,
          sourceColumn: vr.sourceColumn,
          targetTable: vr.targetTable,
          targetColumn: vr.targetColumn,
          relationType: vr.relationType || 'N:1',
          isVirtual: true,
        });
      }
    }

    return result;
  }, [tables, project?.virtualRelations]);

  // Node coordinates state
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 32, y: 28 });

  // Dragging state (either a node or the canvas background)
  const [draggingNode, setDraggingNode] = useState<{
    tableName: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  // Inline "+ Declare Virtual Relation" bar state
  const [showAddRelationBar, setShowAddRelationBar] = useState(false);
  const [relSourceTable, setRelSourceTable] = useState('');
  const [relSourceColumn, setRelSourceColumn] = useState('');
  const [relTargetTable, setRelTargetTable] = useState('');
  const [relTargetColumn, setRelTargetColumn] = useState('');
  const [relCardinality, setRelCardinality] = useState<'N:1' | '1:N' | '1:1' | 'N:M'>('N:1');

  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Auto-layout grid computation
  const computeAutoLayout = () => {
    const colsPerRow = tables.length <= 4 ? 2 : 3;
    const xGap = 340;
    const yGap = 290;
    const nextPos: Record<string, NodePosition> = {};
    tables.forEach((t, idx) => {
      const col = idx % colsPerRow;
      const row = Math.floor(idx / colsPerRow);
      nextPos[t.tableName] = {
        x: col * xGap + 24,
        y: row * yGap + 20,
      };
    });
    setPositions(nextPos);
    setPan({ x: 32, y: 28 });
    setZoom(0.95);
  };

  useEffect(() => {
    if (tables.length > 0) {
      setPositions((prev) => {
        const missing = tables.some((t) => !(t.tableName in prev));
        if (!missing && Object.keys(prev).length > 0) return prev;
        const colsPerRow = tables.length <= 4 ? 2 : 3;
        const xGap = 340;
        const yGap = 290;
        const next: Record<string, NodePosition> = { ...prev };
        tables.forEach((t, idx) => {
          if (!next[t.tableName]) {
            const col = idx % colsPerRow;
            const row = Math.floor(idx / colsPerRow);
            next[t.tableName] = {
              x: col * xGap + 24,
              y: row * yGap + 20,
            };
          }
        });
        return next;
      });

      if (!relSourceTable && tables[0]) {
        setRelSourceTable(tables[0].tableName);
        setRelSourceColumn(tables[0].columns[0]?.name || '');
      }
      if (!relTargetTable && tables[1]) {
        setRelTargetTable(tables[1].tableName);
        setRelTargetColumn(tables[1].columns[0]?.name || '');
      } else if (!relTargetTable && tables[0]) {
        setRelTargetTable(tables[0].tableName);
        setRelTargetColumn(tables[0].columns[0]?.name || '');
      }
    }
  }, [tables]);

  // Global mouse move / up handlers for smooth dragging and panning
  useEffect(() => {
    if (!draggingNode && !isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNode) {
        const dx = (e.clientX - draggingNode.startX) / zoom;
        const dy = (e.clientY - draggingNode.startY) / zoom;
        setPositions((prev) => ({
          ...prev,
          [draggingNode.tableName]: {
            x: Math.max(0, draggingNode.origX + dx),
            y: Math.max(0, draggingNode.origY + dy),
          },
        }));
      } else if (isPanning) {
        const dx = e.clientX - isPanning.startX;
        const dy = e.clientY - isPanning.startY;
        setPan({
          x: isPanning.origPanX + dx,
          y: isPanning.origPanY + dy,
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingNode(null);
      setIsPanning(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNode, isPanning, zoom]);

  const sourceTableObj = tables.find((t) => t.tableName === relSourceTable);
  const targetTableObj = tables.find((t) => t.tableName === relTargetTable);

  const handleAddVirtualRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !relSourceTable || !relSourceColumn || !relTargetTable || !relTargetColumn) {
      return;
    }
    addVirtualRelation(project.id, {
      name: `${relSourceTable}_${relTargetTable}_fk`,
      sourceTable: relSourceTable,
      sourceColumn: relSourceColumn,
      targetTable: relTargetTable,
      targetColumn: relTargetColumn,
      relationType: relCardinality,
      isVirtual: true,
    });
    setShowAddRelationBar(false);
  };

  return (
    <Dialog open={isERDiagramModalOpen} onOpenChange={setERDiagramModalOpen}>
      <DialogContent className="max-w-[92vw] w-[1240px] h-[84vh] p-0 border-slate-800/80 bg-slate-950 text-slate-100 flex flex-col overflow-hidden shadow-2xl">
        {/* Top Modal Header & Action Toolbar */}
        <DialogHeader className="px-5 py-3.5 border-b border-slate-800/70 bg-slate-900/40 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-7">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-indigo-400">
                <Network className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>Entity-Relationship Semantic Model</span>
                  <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[10px] font-mono font-normal text-slate-400">
                    {tables.length} Tables • {edges.length} Relations
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400">
                  Drag table nodes to rearrange. Connect physical SQL tables and imported CSV datasets with virtual foreign keys.
                </DialogDescription>
              </div>
            </div>

            {/* Compact Top Control Bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddRelationBar((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  showAddRelationBar
                    ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                    : 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <Plus className="h-3.5 w-3.5 text-indigo-400" />
                Declare Virtual Relation
              </button>

              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                  title="Zoom Out"
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-slate-300 min-w-[48px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                  title="Zoom In"
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={computeAutoLayout}
                  title="Reset View & Auto-Layout"
                  className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition border-l border-slate-800 ml-0.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Inline "+ Declare Virtual Relation" Bar */}
          {showAddRelationBar && (
            <form
              onSubmit={handleAddVirtualRelation}
              className="mt-3 pt-3 border-t border-slate-800/70 flex flex-wrap items-end gap-2.5 text-xs"
            >
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Source Table</label>
                <select
                  value={relSourceTable}
                  onChange={(e) => {
                    const nextT = e.target.value;
                    setRelSourceTable(nextT);
                    const found = tables.find((t) => t.tableName === nextT);
                    setRelSourceColumn(found?.columns[0]?.name || '');
                  }}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  {tables.map((t) => (
                    <option key={t.tableName} value={t.tableName}>
                      {t.tableName} ({t.source})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Source Column (FK)</label>
                <select
                  value={relSourceColumn}
                  onChange={(e) => setRelSourceColumn(e.target.value)}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  {(sourceTableObj?.columns || []).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Cardinality</label>
                <select
                  value={relCardinality}
                  onChange={(e) =>
                    setRelCardinality(e.target.value as 'N:1' | '1:N' | '1:1' | 'N:M')
                  }
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-indigo-300"
                >
                  <option value="N:1">Many-to-One (* → 1)</option>
                  <option value="1:N">One-to-Many (1 → *)</option>
                  <option value="1:1">One-to-One (1 → 1)</option>
                  <option value="N:M">Many-to-Many (* → *)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Target Table</label>
                <select
                  value={relTargetTable}
                  onChange={(e) => {
                    const nextT = e.target.value;
                    setRelTargetTable(nextT);
                    const found = tables.find((t) => t.tableName === nextT);
                    setRelTargetColumn(found?.columns[0]?.name || '');
                  }}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  {tables.map((t) => (
                    <option key={t.tableName} value={t.tableName}>
                      {t.tableName} ({t.source})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Target Column (PK)</label>
                <select
                  value={relTargetColumn}
                  onChange={(e) => setRelTargetColumn(e.target.value)}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  {(targetTableObj?.columns || []).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition"
              >
                Link Tables
              </button>
            </form>
          )}
        </DialogHeader>

        {/* Interactive Pannable / Zoomable Canvas */}
        <div
          ref={viewportRef}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).dataset.erCanvas === 'true') {
              setIsPanning({
                startX: e.clientX,
                startY: e.clientY,
                origPanX: pan.x,
                origPanY: pan.y,
              });
            }
          }}
          data-er-canvas="true"
          className="relative flex-1 overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          {tables.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-center p-6">
              <Database className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">No Tables in Semantic Model</p>
              <p className="text-xs text-slate-500 mt-1">
                Connect a SQL database or upload CSV files to inspect entity relationships.
              </p>
            </div>
          ) : (
            <div
              data-er-canvas="true"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: '2400px',
                height: '1600px',
              }}
              className="relative"
            >
              {/* SVG Layer for Smooth Cubic Bezier Relationship Curves */}
              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width="2400"
                height="1600"
              >
                <defs>
                  <marker
                    id="er-dot-virtual"
                    viewBox="0 0 8 8"
                    refX="4"
                    refY="4"
                    markerWidth="5"
                    markerHeight="5"
                  >
                    <circle cx="4" cy="4" r="3" fill="#818cf8" />
                  </marker>
                  <marker
                    id="er-dot-physical"
                    viewBox="0 0 8 8"
                    refX="4"
                    refY="4"
                    markerWidth="5"
                    markerHeight="5"
                  >
                    <circle cx="4" cy="4" r="3" fill="#34d399" />
                  </marker>
                </defs>

                {edges.map((edge) => {
                  const sPos = positions[edge.sourceTable];
                  const tPos = positions[edge.targetTable];
                  const sTable = tables.find((t) => t.tableName === edge.sourceTable);
                  const tTable = tables.find((t) => t.tableName === edge.targetTable);
                  if (!sPos || !tPos || !sTable || !tTable) return null;

                  const sColIdx = Math.max(
                    0,
                    sTable.columns.findIndex((c) => c.name === edge.sourceColumn)
                  );
                  const tColIdx = Math.max(
                    0,
                    tTable.columns.findIndex((c) => c.name === edge.targetColumn)
                  );

                  const sY = sPos.y + HEADER_HEIGHT + sColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const tY = tPos.y + HEADER_HEIGHT + tColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  const sourceOnLeft = sPos.x + CARD_WIDTH / 2 <= tPos.x + CARD_WIDTH / 2;
                  const sX = sourceOnLeft ? sPos.x + CARD_WIDTH : sPos.x;
                  const tX = sourceOnLeft ? tPos.x : tPos.x + CARD_WIDTH;

                  const deltaX = Math.max(60, Math.abs(tX - sX) * 0.45);
                  const c1X = sourceOnLeft ? sX + deltaX : sX - deltaX;
                  const c2X = sourceOnLeft ? tX - deltaX : tX + deltaX;

                  const pathData = `M ${sX} ${sY} C ${c1X} ${sY}, ${c2X} ${tY}, ${tX} ${tY}`;
                  const midX = (sX + tX) / 2;
                  const midY = (sY + tY) / 2;

                  const [leftCard, rightCard] =
                    edge.relationType === '1:N'
                      ? ['1', '*']
                      : edge.relationType === '1:1'
                      ? ['1', '1']
                      : edge.relationType === 'N:M'
                      ? ['*', '*']
                      : ['*', '1'];

                  const strokeColor = edge.isVirtual ? '#818cf8' : '#34d399';

                  return (
                    <g key={edge.id}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={1.8}
                        strokeDasharray={edge.isVirtual ? '5 4' : undefined}
                        markerStart={
                          edge.isVirtual ? 'url(#er-dot-virtual)' : 'url(#er-dot-physical)'
                        }
                        markerEnd={
                          edge.isVirtual ? 'url(#er-dot-virtual)' : 'url(#er-dot-physical)'
                        }
                        opacity={0.85}
                      />

                      {/* Cardinality Badges along the curve */}
                      <g transform={`translate(${midX - 20}, ${midY - 10})`}>
                        <rect
                          width="40"
                          height="18"
                          rx="4"
                          fill="#0f172a"
                          stroke={strokeColor}
                          strokeWidth="1"
                        />
                        <text
                          x="20"
                          y="12"
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {leftCard} ── {rightCard}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>

              {/* HTML Table Cards */}
              {tables.map((table) => {
                const pos = positions[table.tableName] || { x: 24, y: 24 };
                return (
                  <div
                    key={table.tableName}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: `${CARD_WIDTH}px`,
                    }}
                    className="absolute rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-xl overflow-hidden"
                  >
                    {/* Draggable Table Header */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingNode({
                          tableName: table.tableName,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: pos.x,
                          origY: pos.y,
                        });
                      }}
                      style={{ height: `${HEADER_HEIGHT}px` }}
                      className="px-3 flex items-center justify-between gap-2 bg-slate-900 border-b border-slate-800 cursor-move"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {table.source === 'CSV' ? (
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Database className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {table.tableName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                            table.source === 'CSV'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {table.dialectLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {table.rowCount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Columns List */}
                    <div className="divide-y divide-slate-800/40 bg-slate-950/80">
                      {table.columns.map((col) => {
                        const isLinked = edges.some(
                          (e) =>
                            (e.sourceTable === table.tableName && e.sourceColumn === col.name) ||
                            (e.targetTable === table.tableName && e.targetColumn === col.name)
                        );
                        return (
                          <div
                            key={col.name}
                            style={{ height: `${ROW_HEIGHT}px` }}
                            className={`px-3 flex items-center justify-between gap-2 text-[11px] ${
                              isLinked ? 'bg-indigo-500/5' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {col.is_primary_key ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[8px] font-mono text-amber-300 shrink-0">
                                  <Key className="h-2.5 w-2.5" /> PK
                                </span>
                              ) : col.is_foreign_key || isLinked ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 px-1 py-0.2 text-[8px] font-mono text-indigo-300 shrink-0">
                                  <Link2 className="h-2.5 w-2.5" /> FK
                                </span>
                              ) : (
                                <span className="w-6 shrink-0" />
                              )}
                              <span className="font-mono text-slate-200 truncate">{col.name}</span>
                            </div>
                            <span className="font-mono text-[9px] text-slate-500 shrink-0">
                              {shortDataType(col.data_type)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Legend & Active Virtual Relations Strip */}
        <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-emerald-400 inline-block" />
              Physical Foreign Key
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-b-2 border-dashed border-indigo-400 inline-block" />
              Virtual Relationship (SQL / CSV)
            </span>
            <span className="inline-flex items-center gap-1">
              <Maximize2 className="h-3 w-3 text-slate-500" /> Drag canvas background to pan
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl">
            {(project?.virtualRelations || []).slice(0, 4).map((vr) => (
              <span
                key={vr.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-300"
              >
                {vr.sourceTable}.{vr.sourceColumn} → {vr.targetTable}.{vr.targetColumn}
                {project && (
                  <button
                    type="button"
                    onClick={() => removeVirtualRelation(project.id, vr.id)}
                    className="text-slate-500 hover:text-rose-400"
                    title="Delete virtual relation"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
