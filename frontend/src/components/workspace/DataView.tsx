import React, { useEffect, useState } from 'react';
import {
  Table2,
  Database,
  Search,
  Download,
  KeyRound,
  Hash,
  Calendar,
  Type,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { dialectLabel } from '../ui/primitives';

export const DataView: React.FC = () => {
  const {
    schemaCatalog,
    activeConnectorId,
    connectors,
    dataViewTable,
    openTableInDataView,
    fetchSchema,
  } = useDashboardStore();

  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableSearch, setTableSearch] = useState('');
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableCols, setTableCols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const activeConnector = connectors.find((c) => c.id === activeConnectorId);
  const tables = schemaCatalog?.tables || [];

  useEffect(() => {
    if (dataViewTable) {
      setSelectedTable(dataViewTable);
    } else if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].table_name);
    }
  }, [dataViewTable, tables]);

  useEffect(() => {
    if (!selectedTable) return;
    loadTableData(selectedTable);
  }, [selectedTable, activeConnectorId]);

  const loadTableData = async (tblName: string) => {
    setIsLoading(true);
    setQueryError(null);
    try {
      const res = await fetch(`/api/connectors/${activeConnectorId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT * FROM ${tblName} LIMIT 100`,
          max_rows: 100,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to query table');
      }
      const data = await res.json();
      setTableCols(data.columns || []);
      setTableRows(data.rows || []);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : String(err));
      setTableCols([]);
      setTableRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentTableProfile = tables.find((t) => t.table_name === selectedTable);

  const exportCurrentTableCsv = () => {
    if (!tableCols.length || !tableRows.length) return;
    const header = tableCols.join(',');
    const lines = tableRows.map((r) =>
      tableCols.map((c) => JSON.stringify(r[c] ?? '')).join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTables = tables.filter((t) =>
    t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-white select-none text-xs">
      {/* 1. Left Tables Sidebar (Power BI Data View style) */}
      <aside aria-label="Tables Directory" className="w-64 border-r border-line bg-[#faf9f8] flex flex-col shrink-0">
        <div className="p-3 border-b border-line space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Database className="h-4 w-4 text-focus" />
              <span>{activeConnector?.name || 'Active Database'}</span>
            </span>
            <span className="text-2xs font-mono uppercase bg-white border border-line px-1.5 py-0.5 rounded text-muted">
              {activeConnector?.dialect ? dialectLabel(activeConnector.dialect) : 'SQL'}
            </span>
          </div>

          <div className="relative">
            <Search className="h-3 w-3 text-muted absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search tables..."
              className="h-7 w-full rounded border border-line-strong bg-white pl-6 pr-2 text-2xs text-ink placeholder:text-muted focus:border-focus focus:outline-none"
            />
          </div>
        </div>

        {/* Tables list */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredTables.map((tbl) => {
            const isSelected = tbl.table_name === selectedTable;
            return (
              <button
                key={tbl.table_name}
                onClick={() => {
                  setSelectedTable(tbl.table_name);
                  openTableInDataView(tbl.table_name);
                }}
                className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-focus-tint border border-focus/30 text-focus font-semibold'
                    : 'hover:bg-hover text-ink border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Table2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="font-mono truncate">{tbl.table_name}</span>
                </div>
                <span className="text-2xs text-muted font-mono tnum shrink-0 ml-2">
                  {tbl.row_count}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* 2. Main Data Grid Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Table Top Bar */}
        <div className="h-10 px-4 border-b border-line flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-semibold text-ink text-sm">
              <Table2 className="h-4 w-4 text-focus" />
              <span className="font-mono">{selectedTable || 'No table selected'}</span>
            </div>
            {currentTableProfile && (
              <span className="text-2xs text-muted">
                {currentTableProfile.row_count.toLocaleString()} rows • {currentTableProfile.columns.length} columns
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadTableData(selectedTable)}
              disabled={isLoading || !selectedTable}
              className="h-7 px-2.5 rounded border border-line bg-white hover:bg-hover text-ink text-2xs font-medium flex items-center gap-1 transition"
            >
              <RefreshCw className={`h-3 w-3 text-muted ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCurrentTableCsv}
              disabled={!tableRows.length}
              className="h-7 px-2.5 rounded border border-line-strong bg-white hover:bg-hover text-ink text-2xs font-semibold flex items-center gap-1 transition disabled:opacity-40"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        </div>

        {/* Schema Column Chips Bar */}
        {currentTableProfile && (
          <div className="px-4 py-2 border-b border-line bg-[#faf9f8] flex flex-wrap gap-1.5 overflow-x-auto shrink-0">
            {currentTableProfile.columns.map((col) => {
              const isNum =
                col.data_type.toLowerCase().includes('int') ||
                col.data_type.toLowerCase().includes('float') ||
                col.data_type.toLowerCase().includes('double') ||
                col.data_type.toLowerCase().includes('decimal');
              const isDate =
                col.data_type.toLowerCase().includes('date') ||
                col.data_type.toLowerCase().includes('time');

              return (
                <div
                  key={col.name}
                  className="rounded bg-white border border-line px-2 py-1 text-2xs text-ink flex items-center gap-1 shadow-2xs"
                  title={`${col.name} (${col.data_type})${col.distinct_count ? ` — ${col.distinct_count} distinct` : ''}`}
                >
                  {col.is_primary_key ? (
                    <KeyRound className="h-2.5 w-2.5 text-[#c19c00]" />
                  ) : isNum ? (
                    <Hash className="h-2.5 w-2.5 text-focus" />
                  ) : isDate ? (
                    <Calendar className="h-2.5 w-2.5 text-good" />
                  ) : (
                    <Type className="h-2.5 w-2.5 text-subtle" />
                  )}
                  <span className="font-mono font-medium">{col.name}</span>
                  <span className="text-muted font-mono text-[10px]">({col.data_type})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid Preview Area */}
        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-focus" />
              <span>Querying table records...</span>
            </div>
          ) : queryError ? (
            <div className="p-6 text-bad font-mono text-xs">{queryError}</div>
          ) : tableRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted">
              <span>No records found in table.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f3f2f1] sticky top-0 z-10 border-b border-line">
                <tr>
                  <th className="px-3 py-2 text-2xs font-semibold text-muted border-r border-line w-12 text-center">
                    #
                  </th>
                  {tableCols.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-2xs font-semibold text-muted border-r border-line whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tableRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-hover/60 transition-colors">
                    <td className="px-3 py-1.5 text-2xs text-muted text-center border-r border-line font-mono tnum">
                      {idx + 1}
                    </td>
                    {tableCols.map((c) => {
                      const val = row[c];
                      const isNum = typeof val === 'number';
                      return (
                        <td
                          key={c}
                          className={`px-3 py-1.5 whitespace-nowrap border-r border-line text-2xs ${
                            isNum ? 'text-right font-mono tnum text-ink' : 'text-ink'
                          }`}
                        >
                          {isNum ? val.toLocaleString() : String(val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};
