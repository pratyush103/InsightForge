import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
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
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { SQLDialectType } from '../../types/insightforge';

export const ConnectorModal: React.FC = () => {
  const {
    connectors,
    activeConnectorId,
    schemaCatalog,
    isConnectorModalOpen,
    setConnectorModalOpen,
    fetchConnectors,
    selectConnector,
    fetchSchema,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'connectors' | 'schema' | 'sandbox'>('connectors');

  // New connector form state
  const [dialect, setDialect] = useState<SQLDialectType>('mysql');
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
    if (isConnectorModalOpen) {
      fetchConnectors();
      fetchSchema();
    }
  }, [isConnectorModalOpen]);

  if (!isConnectorModalOpen) return null;

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
        name: name.trim() || `${dialect.toUpperCase()} Database`,
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
      setFormSuccess(`Imported CSV into SQLite table '${data.table.table_name}' (${data.table.row_count} rows)`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                SQL Connectors & Schema Introspection
              </h2>
              <p className="text-xs text-slate-400">
                Connect SQLite, MySQL, or Microsoft SQL Server (T-SQL) with read-only SQLGlot AST protection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('connectors')}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  activeTab === 'connectors'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Connectors ({connectors.length})
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  activeTab === 'schema'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Schema Catalog ({schemaCatalog?.tables.length || 0} Tables)
              </button>
              <button
                onClick={() => setActiveTab('sandbox')}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  activeTab === 'sandbox'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SQL Sandbox
              </button>
            </div>

            <button
              onClick={() => setConnectorModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'connectors' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Active Connectors + CSV Import */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Registered Data Sources
                  </h3>
                  {connectors.map((c) => {
                    const isSelected = c.id === activeConnectorId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectConnector(c.id)}
                        className={`cursor-pointer rounded-xl border p-3.5 transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300 border border-slate-700">
                              {c.dialect}
                            </span>
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {c.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span className="font-mono truncate">{c.database_display}</span>
                            <span>• {c.table_count} tables</span>
                            <span>• {c.total_rows.toLocaleString()} rows</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
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
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick CSV to SQLite Table Uploader */}
                <form
                  onSubmit={handleCsvUpload}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    Import CSV into Active SQLite Database
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Upload any CSV file to mount it as an indexed SQL table inside your active SQLite database.
                  </p>
                  <input
                    type="text"
                    value={csvTableName}
                    onChange={(e) => setCsvTableName(e.target.value)}
                    placeholder="Target table name (optional)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700"
                    />
                    <button
                      type="submit"
                      disabled={!csvFile || isUploadingCsv}
                      className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
                    >
                      {isUploadingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Import
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Add New SQLite / MySQL / MS SQL Server Connection */}
              <div className="lg:col-span-7">
                <form
                  onSubmit={handleCreateConnector}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-indigo-400" />
                      Add SQL Database Connector
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Read-Only AST Guard Active
                    </span>
                  </div>

                  {/* Dialect Selector Tabs */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'mysql', label: 'MySQL', sub: 'Port 3306 • mysql+pymysql' },
                        { id: 'mssql', label: 'MS SQL Server', sub: 'Port 1433 • T-SQL Dialect' },
                        { id: 'sqlite', label: 'SQLite', sub: 'Local .db / .sqlite File' },
                      ] as const
                    ).map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => handleDialectChange(d.id)}
                        className={`rounded-xl border p-3 text-left transition ${
                          dialect === d.id
                            ? 'border-indigo-500 bg-indigo-500/15 text-slate-100'
                            : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">{d.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{d.sub}</div>
                      </button>
                    ))}
                  </div>

                  {formError && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                      {formError}
                    </div>
                  )}
                  {formSuccess && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                      {formSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Connection Display Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`Production ${dialect.toUpperCase()} Warehouse`}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {dialect === 'sqlite' ? (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          SQLite Database File Path (.db / .sqlite)
                        </label>
                        <input
                          type="text"
                          value={sqlitePath}
                          onChange={(e) => setSqlitePath(e.target.value)}
                          placeholder="data/insightforge_commerce.db"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            {dialect === 'mssql' ? 'SQL Server Host / Instance' : 'MySQL Host'}
                          </label>
                          <input
                            type="text"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost or 10.0.0.15"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Port
                          </label>
                          <input
                            type="text"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Database Name
                          </label>
                          <input
                            type="text"
                            value={database}
                            onChange={(e) => setDatabase(e.target.value)}
                            placeholder="analytics_prod"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={dialect === 'mssql' ? 'sa' : 'readonly_bi'}
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2 pt-1">
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Or Full SQLAlchemy URI Override (Optional)
                      </label>
                      <input
                        type="text"
                        value={connectionUri}
                        onChange={(e) => setConnectionUri(e.target.value)}
                        placeholder={
                          dialect === 'mysql'
                            ? 'mysql+pymysql://user:pass@localhost:3306/dbname'
                            : dialect === 'mssql'
                            ? 'mssql+pymssql://sa:pass@localhost:1433/dbname'
                            : 'sqlite:///path/to/database.db'
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-300 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                      Test & Connect {dialect.toUpperCase()}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'schema' && schemaCatalog && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 font-mono font-semibold uppercase text-indigo-300">
                    {schemaCatalog.dialect}
                  </span>
                  <span className="font-semibold text-slate-100">{schemaCatalog.connector_name}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-mono text-slate-400">{schemaCatalog.schema_fingerprint}</span>
                </div>
                <span className="text-slate-400">
                  {schemaCatalog.tables.length} tables •{' '}
                  {schemaCatalog.tables.reduce((acc, t) => acc + t.row_count, 0).toLocaleString()} total rows
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schemaCatalog.tables.map((tbl) => (
                  <div
                    key={tbl.table_name}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-cyan-400" />
                        <span className="font-mono text-sm font-semibold text-slate-100">
                          {tbl.table_name}
                        </span>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-mono text-slate-300">
                        {tbl.row_count.toLocaleString()} rows
                      </span>
                    </div>
                    {tbl.description && (
                      <p className="text-xs text-slate-400">{tbl.description}</p>
                    )}

                    <div className="divide-y divide-slate-800/70 border-t border-slate-800 pt-1">
                      {tbl.columns.map((col) => (
                        <div
                          key={col.name}
                          className="py-1.5 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-slate-200 font-medium truncate">
                              {col.name}
                            </span>
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                              {col.data_type}
                            </span>
                            {col.is_primary_key && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                <KeyRound className="h-2.5 w-2.5" /> PK
                              </span>
                            )}
                            {col.is_foreign_key && (
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
                                FK → {col.foreign_key_target}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                            {col.distinct_count !== null && `${col.distinct_count} distinct`}
                          </div>
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    Read-Only SQL Query Runner ({schemaCatalog?.dialect.toUpperCase()})
                  </label>
                  <button
                    onClick={handleRunSandboxSql}
                    disabled={isRunningSql}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white transition"
                  >
                    {isRunningSql ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    Execute SELECT
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={sandboxSql}
                  onChange={(e) => setSandboxSql(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {sandboxResult && (
                <div className="space-y-3">
                  {sandboxResult.error ? (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono">
                      {sandboxResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Transpiled SQL:{' '}
                          <code className="font-mono text-indigo-300">{sandboxResult.executed_sql}</code>
                        </span>
                        <span className="font-mono">
                          {sandboxResult.rows.length} rows in {sandboxResult.execution_ms} ms
                        </span>
                      </div>
                      <div className="max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-900/90 sticky top-0">
                            <tr>
                              {sandboxResult.columns.map((c) => (
                                <th key={c} className="px-3 py-2 font-mono font-semibold text-slate-300 border-b border-slate-800">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {sandboxResult.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-900/50">
                                {sandboxResult.columns.map((c) => (
                                  <td key={c} className="px-3 py-1.5 font-mono text-slate-300 whitespace-nowrap">
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
