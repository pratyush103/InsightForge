import React, { useEffect, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Loader2,
  Play,
  Plus,
  Server,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { SQLDialectType } from '../../types/insightforge';
import { dialectLabel } from '../ui/primitives';

export const ConnectorModal: React.FC = () => {
  const {
    connectors,
    activeConnectorId,
    schemaCatalog,
    isConnectorModalOpen,
    setConnectorModalOpen,
    getDataSource,
    openGetData,
    fetchConnectors,
    selectConnector,
    fetchSchema,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'connectors' | 'schema' | 'sandbox'>('connectors');

  // New connector form state
  const [dialect, setDialect] = useState<SQLDialectType>('sqlite');
  const [name, setName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [sqlitePath, setSqlitePath] = useState('');
  const [connectionUri, setConnectionUri] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Upload state
  const [csvTableName, setCsvTableName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // SQL Sandbox state
  const [sandboxSql, setSandboxSql] = useState(
    'SELECT region, segment, COUNT(*) AS orders, ROUND(SUM(net_revenue), 2) AS net_revenue FROM orders GROUP BY region, segment ORDER BY net_revenue DESC'
  );
  const [sandboxResult, setSandboxResult] = useState<{
    success: boolean;
    executed_sql: string;
    columns: string[];
    rows: Record<string, unknown>[];
    execution_ms: number;
    error?: string;
  } | null>(null);
  const [isRunningSql, setIsRunningSql] = useState(false);

  useEffect(() => {
    if (isConnectorModalOpen || getDataSource) {
      fetchConnectors();
      fetchSchema();
      if (getDataSource && getDataSource !== 'csv') {
        setDialect(getDataSource);
      }
    }
  }, [isConnectorModalOpen, getDataSource]);

  const isOpen = isConnectorModalOpen || !!getDataSource;

  if (!isOpen) return null;

  const handleClose = () => {
    setConnectorModalOpen(false);
    openGetData(null);
  };

  const handleDialectChange = (d: SQLDialectType) => {
    setDialect(d);
    setFormError(null);
    if (d === 'mysql') setPort('3306');
    if (d === 'mssql') setPort('1433');
  };

  const handleCreateConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim() || `${dialectLabel(dialect)} Database`,
        dialect,
        sqlite_path: dialect === 'sqlite' ? sqlitePath : undefined,
        host: dialect !== 'sqlite' ? host : undefined,
        port: dialect !== 'sqlite' && port ? parseInt(port, 10) : undefined,
        database: dialect !== 'sqlite' ? database : undefined,
        username: dialect !== 'sqlite' ? username : undefined,
        password: dialect !== 'sqlite' ? password : undefined,
        connection_uri: connectionUri.trim() || undefined,
      };
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Connection failed');
      }
      const created = await res.json();
      setFormSuccess(`Connected to ${created.name} (${created.table_count} tables profiled)`);
      await fetchConnectors();
      await selectConnector(created.id);
      setName('');
      setPassword('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsUploadingCsv(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const formData = new FormData();
      formData.append('table_name', csvTableName.trim() || csvFile.name.replace(/\.csv$/i, ''));
      formData.append('file', csvFile);

      const res = await fetch(`/api/connectors/${activeConnectorId}/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'CSV upload failed');
      }
      const data = await res.json();
      setFormSuccess(`Imported CSV into table '${data.table.table_name}' (${data.table.row_count} rows)`);
      setCsvFile(null);
      setCsvTableName('');
      await fetchConnectors();
      await fetchSchema(activeConnectorId, true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleDeleteConnector = async (cid: string) => {
    await fetch(`/api/connectors/${cid}`, { method: 'DELETE' });
    await fetchConnectors();
    if (activeConnectorId === cid) {
      await selectConnector('default_sqlite_commerce');
    }
  };

  const handleRunSandboxSql = async () => {
    setIsRunningSql(true);
    try {
      const res = await fetch(`/api/connectors/${activeConnectorId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sandboxSql, max_rows: 200 }),
      });
      const data = await res.json();
      setSandboxResult(data);
    } finally {
      setIsRunningSql(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded bg-white border border-line-strong shadow-dialog flex flex-col text-xs">
        {/* Power BI Get Data Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-focus-tint border border-focus/20 flex items-center justify-center text-focus">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Get Data & Manage SQL Connectors</h2>
              <p className="text-2xs text-muted">
                Connect SQLite, MySQL, or SQL Server databases with read-only SQLGlot AST verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View tabs */}
            <div className="flex rounded border border-line bg-[#faf9f8] p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('connectors')}
                className={`px-3 py-1 rounded font-medium transition ${
                  activeTab === 'connectors'
                    ? 'bg-white text-ink shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Connectors ({connectors.length})
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={`px-3 py-1 rounded font-medium transition ${
                  activeTab === 'schema'
                    ? 'bg-white text-ink shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Catalog ({schemaCatalog?.tables.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('sandbox')}
                className={`px-3 py-1 rounded font-medium transition ${
                  activeTab === 'sandbox'
                    ? 'bg-white text-ink shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                SQL Sandbox
              </button>
            </div>

            <button
              onClick={handleClose}
              className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'connectors' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Registered Data Sources & CSV Import */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-2">
                  <h3 className="text-2xs font-bold uppercase tracking-wider text-muted">
                    Data Sources
                  </h3>
                  {connectors.map((c) => {
                    const isSelected = c.id === activeConnectorId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectConnector(c.id)}
                        className={`cursor-pointer rounded border p-3 transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-focus bg-focus-tint/50 shadow-2xs'
                            : 'border-line bg-white hover:bg-[#faf9f8]'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-2xs uppercase px-1.5 py-0.2 rounded bg-[#f3f2f1] border border-line text-ink font-semibold">
                              {c.dialect}
                            </span>
                            <span className="font-semibold text-xs text-ink truncate">
                              {c.name}
                            </span>
                          </div>
                          <div className="text-2xs text-muted flex items-center gap-1.5 font-mono">
                            <span className="truncate">{c.database_display}</span>
                            <span>• {c.table_count} tables</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#f1faf1] border border-good/30 px-2 py-0.5 text-2xs font-semibold text-good">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                          {!c.is_builtin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConnector(c.id);
                              }}
                              className="rounded p-1 text-muted hover:bg-hover hover:text-bad"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CSV to SQLite Table Uploader */}
                <form
                  onSubmit={handleCsvUpload}
                  className="rounded border border-line bg-[#faf9f8] p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <FileSpreadsheet className="h-4 w-4 text-good" />
                    <span>Import CSV to Active SQLite Database</span>
                  </div>
                  <p className="text-2xs text-muted leading-relaxed">
                    Upload a CSV file to index and query it as a relational table.
                  </p>
                  <input
                    type="text"
                    value={csvTableName}
                    onChange={(e) => setCsvTableName(e.target.value)}
                    placeholder="Custom table name (optional)"
                    className="w-full h-8 rounded border border-line-strong bg-white px-3 text-xs text-ink font-mono focus:border-focus focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="text-2xs text-muted file:mr-2 file:h-7 file:rounded file:border-0 file:bg-white file:border-line file:border file:px-2.5 file:text-2xs file:font-semibold file:text-ink hover:file:bg-hover"
                    />
                    <button
                      type="submit"
                      disabled={!csvFile || isUploadingCsv}
                      className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-7 rounded bg-good hover:bg-[#0c6b0c] disabled:opacity-40 px-3 text-2xs font-semibold text-white transition"
                    >
                      {isUploadingCsv ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Import
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Add New SQL Connection */}
              <div className="lg:col-span-7">
                <form
                  onSubmit={handleCreateConnector}
                  className="rounded border border-line bg-white p-5 space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <h3 className="font-semibold text-ink text-sm flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-focus" />
                      Add New Database Connection
                    </h3>
                    <span className="inline-flex items-center gap-1 text-2xs text-good font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" /> Read-Only AST Guard
                    </span>
                  </div>

                  {/* Dialect Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'sqlite', label: 'SQLite', sub: 'Local file' },
                        { id: 'mysql', label: 'MySQL', sub: 'Port 3306' },
                        { id: 'mssql', label: 'SQL Server', sub: 'T-SQL Dialect' },
                      ] as const
                    ).map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => handleDialectChange(d.id)}
                        className={`rounded border p-2.5 text-left transition ${
                          dialect === d.id
                            ? 'border-focus bg-focus-tint text-ink font-semibold'
                            : 'border-line bg-white text-muted hover:bg-hover'
                        }`}
                      >
                        <div className="text-xs">{d.label}</div>
                        <div className="text-2xs text-muted mt-0.5">{d.sub}</div>
                      </button>
                    ))}
                  </div>

                  {formError && (
                    <div className="rounded border border-bad/40 bg-[#fdf3f4] p-2.5 text-xs text-bad">
                      {formError}
                    </div>
                  )}
                  {formSuccess && (
                    <div className="rounded border border-good/40 bg-[#f1faf1] p-2.5 text-xs text-good">
                      {formSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-2xs font-semibold text-muted mb-1">
                        Connection Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`Production ${dialectLabel(dialect)} Database`}
                        className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs text-ink focus:border-focus focus:outline-none"
                      />
                    </div>

                    {dialect === 'sqlite' ? (
                      <div className="sm:col-span-2">
                        <label className="block text-2xs font-semibold text-muted mb-1">
                          Database File Path (.db / .sqlite)
                        </label>
                        <input
                          type="text"
                          value={sqlitePath}
                          onChange={(e) => setSqlitePath(e.target.value)}
                          placeholder="data/insightforge_commerce.db"
                          className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-2xs font-semibold text-muted mb-1">
                            {dialect === 'mssql' ? 'Server / Host' : 'Host'}
                          </label>
                          <input
                            type="text"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost"
                            className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-2xs font-semibold text-muted mb-1">
                            Port
                          </label>
                          <input
                            type="text"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-2xs font-semibold text-muted mb-1">
                            Database Name
                          </label>
                          <input
                            type="text"
                            value={database}
                            onChange={(e) => setDatabase(e.target.value)}
                            placeholder="analytics_prod"
                            className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-2xs font-semibold text-muted mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-2xs font-semibold text-muted mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2 pt-1">
                      <label className="block text-2xs font-semibold text-muted mb-1">
                        Or Full SQLAlchemy URI Override (Optional)
                      </label>
                      <input
                        type="text"
                        value={connectionUri}
                        onChange={(e) => setConnectionUri(e.target.value)}
                        placeholder="sqlite:///path/to/database.db"
                        className="w-full h-8 rounded border border-line-strong bg-white px-2.5 text-xs font-mono text-ink focus:border-focus focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 h-8 rounded bg-focus hover:bg-[#0c5a9e] disabled:opacity-40 px-4 text-xs font-semibold text-white transition"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Server className="h-3.5 w-3.5" />
                      )}
                      Connect Database
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'schema' && schemaCatalog && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded border border-line bg-[#faf9f8] p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{schemaCatalog.connector_name}</span>
                  <span className="text-muted">•</span>
                  <span className="font-mono text-muted text-2xs">{schemaCatalog.schema_fingerprint}</span>
                </div>
                <span className="text-muted">
                  {schemaCatalog.tables.length} tables •{' '}
                  {schemaCatalog.tables.reduce((acc, t) => acc + t.row_count, 0).toLocaleString()} total rows
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schemaCatalog.tables.map((tbl) => (
                  <div key={tbl.table_name} className="rounded border border-line bg-white p-3.5 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-line">
                      <div className="flex items-center gap-1.5">
                        <Table2 className="h-3.5 w-3.5 text-focus" />
                        <span className="font-mono font-semibold text-xs text-ink">{tbl.table_name}</span>
                      </div>
                      <span className="text-2xs text-muted font-mono">{tbl.row_count} rows</span>
                    </div>

                    <div className="divide-y divide-line pt-0.5">
                      {tbl.columns.map((col) => (
                        <div key={col.name} className="py-1 flex items-center justify-between text-2xs">
                          <div className="flex items-center gap-1 font-mono">
                            {col.is_primary_key && (
                              <KeyRound className="h-2.5 w-2.5 text-[#c19c00]" />
                            )}
                            <span className="font-medium text-ink">{col.name}</span>
                            <span className="text-muted">({col.data_type})</span>
                          </div>
                          <span className="text-muted font-mono text-[10px]">
                            {col.distinct_count ? `${col.distinct_count} distinct` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-focus" />
                    Read-Only SQL Query Runner ({schemaCatalog?.dialect.toUpperCase()})
                  </label>
                  <button
                    onClick={handleRunSandboxSql}
                    disabled={isRunningSql}
                    className="inline-flex items-center gap-1.5 h-7 rounded bg-focus hover:bg-[#0c5a9e] px-3 text-xs font-semibold text-white transition"
                  >
                    {isRunningSql ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 fill-current" />
                    )}
                    Execute Query
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={sandboxSql}
                  onChange={(e) => setSandboxSql(e.target.value)}
                  className="w-full rounded border border-line-strong bg-white p-2.5 font-mono text-xs text-ink focus:border-focus focus:outline-none"
                />
              </div>

              {sandboxResult && (
                <div className="space-y-2">
                  {sandboxResult.error ? (
                    <div className="rounded border border-bad/40 bg-[#fdf3f4] p-3 text-xs text-bad font-mono">
                      {sandboxResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-2xs text-muted">
                        <span>
                          Transpiled:{' '}
                          <code className="font-mono text-ink">{sandboxResult.executed_sql}</code>
                        </span>
                        <span className="font-mono tnum">
                          {sandboxResult.rows.length} rows in {sandboxResult.execution_ms} ms
                        </span>
                      </div>
                      <div className="max-h-60 overflow-auto rounded border border-line bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#faf9f8] sticky top-0 border-b border-line">
                            <tr>
                              {sandboxResult.columns.map((c) => (
                                <th key={c} className="px-3 py-1.5 text-2xs font-semibold text-muted border-r border-line">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {sandboxResult.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-hover">
                                {sandboxResult.columns.map((c) => (
                                  <td key={c} className="px-3 py-1 font-mono text-2xs text-ink border-r border-line whitespace-nowrap">
                                    {String(r[c] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
