import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Code2, Download, Search, Table } from 'lucide-react';
import type { DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  widget: DashboardWidgetSpec;
}

export const DataTableWidget: React.FC<Props> = ({ widget }) => {
  const { crossFilter, setEditingWidget } = useDashboardStore();
  const { projects, activeProjectId, updateWidgetScope } = useProjectStore();

  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const activePage = useMemo(() => {
    if (!project) return null;
    return (
      project.pages.find((pg) => pg.id === project.activePageId) ||
      project.pages[0] ||
      null
    );
  }, [project]);

  const widgetScope = activePage?.widgetScopes?.[widget.id];

  const [search, setSearch] = useState(widgetScope?.selectedCategory || '');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const visibleColumns = useMemo(
    () => widget.columns.filter((c) => !c.endsWith('_ma3') && !c.endsWith('_zscore')),
    [widget.columns]
  );

  const filteredAndSortedRows = useMemo(() => {
    let list = [...widget.rows];

    if (crossFilter && list.length > 0 && crossFilter.column in list[0]) {
      const cfRows = list.filter((r) => String(r[crossFilter.column]) === crossFilter.value);
      if (cfRows.length > 0) list = cfRows;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        visibleColumns.some((c) => String(r[c] ?? '').toLowerCase().includes(q))
      );
    }

    if (widgetScope?.zoomEnd && widgetScope.zoomEnd < 100 && list.length > 1) {
      const count = Math.max(1, Math.ceil((list.length * widgetScope.zoomEnd) / 100));
      list = list.slice(0, count);
    }

    if (sortCol) {
      list.sort((a, b) => {
        const va = a[sortCol];
        const vb = b[sortCol];
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortAsc ? va - vb : vb - va;
        }
        return sortAsc
          ? String(va ?? '').localeCompare(String(vb ?? ''))
          : String(vb ?? '').localeCompare(String(va ?? ''));
      });
    }
    return list;
  }, [widget.rows, crossFilter, search, widgetScope, sortCol, sortAsc, visibleColumns]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const exportCsv = () => {
    const header = visibleColumns.join(',');
    const lines = filteredAndSortedRows.map((r) =>
      visibleColumns.map((c) => JSON.stringify(r[c] ?? '')).join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widget.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full flex flex-col justify-between p-3.5 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/50">
        <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-2">
          <Table className="h-3.5 w-3.5 text-slate-400" />
          <div>
            <h3 className="text-xs font-medium text-slate-200">{widget.title}</h3>
            <p className="text-[11px] text-slate-500">
              {filteredAndSortedRows.length} records • {widget.subtitle}
            </p>
          </div>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5"
        >
          <div className="relative">
            <Search className="h-3 w-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (project) {
                  updateWidgetScope(project.id, widget.id, {
                    selectedCategory: val || undefined,
                  });
                }
              }}
              placeholder="Filter records..."
              className="rounded border border-slate-800/80 bg-slate-950/90 pl-7 pr-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-slate-700 focus:outline-none w-36"
            />
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded border border-slate-800/80 bg-slate-900/80 hover:bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 transition"
          >
            <Download className="h-3 w-3" /> CSV
          </button>

          <button
            onClick={() => setEditingWidget(widget)}
            title="Inspect SQL"
            className="rounded p-1 text-slate-500 hover:bg-slate-800/80 hover:text-slate-200 transition"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 min-h-0 overflow-auto mt-2 rounded-lg border border-slate-800/60 bg-slate-950/50">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/90 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="cursor-pointer px-3 py-1.5 font-mono text-[11px] font-medium text-slate-400 border-b border-slate-800/70 hover:text-slate-200 whitespace-nowrap"
                >
                  <div className="inline-flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    <ArrowUpDown className="h-2.5 w-2.5 text-slate-600" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredAndSortedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-900/50 transition">
                {visibleColumns.map((col) => {
                  const val = row[col];
                  const isNum = typeof val === 'number';
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 whitespace-nowrap text-[11px] ${
                        isNum ? 'font-mono text-slate-200' : 'text-slate-300'
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
      </div>
    </div>
  );
};
