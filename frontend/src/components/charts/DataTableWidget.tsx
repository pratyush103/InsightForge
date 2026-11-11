import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Code2, Download, Search, Table2 } from 'lucide-react';
import type { DashboardWidgetSpec } from '../../types/insightforge';
import { useDashboardStore } from '../../store/useDashboardStore';

interface Props {
  widget: DashboardWidgetSpec;
}

export const DataTableWidget: React.FC<Props> = ({ widget }) => {
  const { crossFilter, setEditingWidget, selectedWidgetId, selectWidget } = useDashboardStore();
  const [search, setSearch] = useState('');
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
  }, [widget.rows, crossFilter, search, sortCol, sortAsc, visibleColumns]);

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

  const isSelected = selectedWidgetId === widget.id;

  return (
    <div
      onClick={() => selectWidget(widget.id)}
      className={`h-full w-full flex flex-col justify-between p-3 select-none bg-white rounded transition-shadow ${
        isSelected ? 'ring-2 ring-focus' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-line">
        <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-1.5 min-w-0">
          <Table2 className="h-4 w-4 text-focus shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-ink truncate">{widget.title}</h3>
            <p className="text-2xs text-muted truncate">
              {filteredAndSortedRows.length} rows • {widget.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="h-3 w-3 text-muted absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find in table..."
              className="h-6 w-32 rounded border border-line-strong bg-white pl-6 pr-2 text-2xs text-ink placeholder:text-subtle focus:border-focus focus:outline-none"
            />
          </div>

          <button
            onClick={exportCsv}
            title="Export CSV"
            className="inline-flex items-center gap-1 h-6 rounded border border-line-strong bg-white px-2 text-2xs font-medium text-ink hover:bg-hover transition"
          >
            <Download className="h-3 w-3" /> CSV
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingWidget(widget);
            }}
            title="Inspect SQL"
            className="rounded p-1 text-muted hover:bg-hover hover:text-ink transition"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="flex-1 min-h-0 overflow-auto my-1.5 rounded border border-line bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#f9f8f7] sticky top-0 z-10 border-b border-line">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="cursor-pointer px-2.5 py-1.5 text-2xs font-semibold text-muted hover:text-ink whitespace-nowrap select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    <ArrowUpDown className="h-2.5 w-2.5 text-subtle" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredAndSortedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-hover/60 transition-colors">
                {visibleColumns.map((col) => {
                  const val = row[col];
                  const isNum = typeof val === 'number';
                  return (
                    <td
                      key={col}
                      className={`px-2.5 py-1 whitespace-nowrap text-2xs ${
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
      </div>
    </div>
  );
};
