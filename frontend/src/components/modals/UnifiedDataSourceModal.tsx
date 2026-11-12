import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitFork,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Server,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import type {
  ColumnProfile,
  SchemaCatalog,
  SQLDialectType,
  TableProfile,
} from '../../types/insightforge';
import type { DataSourceConfig, EmbeddedCsvTable } from '../../types/project';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

type SourcePickerKind = 'sqlite' | 'mssql' | 'mysql' | 'csv';

function sanitizeTableName(raw: string): string {
  const cleaned = raw
    .replace(/\.csv$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return 'csv_table';
  return /^[0-9]/.test(cleaned) ? `t_${cleaned}` : cleaned;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(csvText: string): {
  columns: string[];
  rows: Record<string, unknown>[];
  columnProfiles: ColumnProfile[];
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { columns: [], rows: [], columnProfiles: [] };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const columns = rawHeaders.map((h, idx) => {
    const clean = h.replace(/^["']|["']$/g, '').trim();
    return clean || `column_${idx + 1}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rowObj: Record<string, unknown> = {};
    columns.forEach((col, cIdx) => {
      const rawVal = values[cIdx] ?? '';
      if (rawVal === '') {
        rowObj[col] = null;
      } else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
        rowObj[col] = Number(rawVal);
      } else {
        rowObj[col] = rawVal;
      }
    });
    rows.push(rowObj);
  }

  const columnProfiles: ColumnProfile[] = columns.map((col, idx) => {
    const nonNullVals = rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== undefined && v !== '');
    const allNumbers =
      nonNullVals.length > 0 && nonNullVals.every((v) => typeof v === 'number');
    const allInts =
      allNumbers && nonNullVals.every((v) => Number.isInteger(v as number));
    const looksLikeDate =
      !allNumbers &&
      nonNullVals.length > 0 &&
      nonNullVals
        .slice(0, 10)
        .every((v) => /^\d{4}-\d{2}-\d{2}/.test(String(v)));

    let dataType = 'VARCHAR';
    if (allInts) dataType = 'INTEGER';
    else if (allNumbers) dataType = 'DECIMAL';
    else if (looksLikeDate) dataType = 'DATE';

    const distinctSet = new Set(nonNullVals.map((v) => String(v)));
    const isPk =
      idx === 0 &&
      (/id$/i.test(col) || /^id$/i.test(col)) &&
      distinctSet.size === rows.length &&
      rows.length > 0;
    const isFk = !isPk && /_id$/i.test(col);

    return {
      name: col,
      data_type: dataType,
      nullable: nonNullVals.length < rows.length,
      is_primary_key: isPk,
      is_foreign_key: isFk,
      foreign_key_target: null,
      distinct_count: distinctSet.size,
      null_count: rows.length - nonNullVals.length,
      min_value: nonNullVals[0] ?? null,
      max_value: nonNullVals[nonNullVals.length - 1] ?? null,
      sample_values: nonNullVals.slice(0, 4),
    };
  });

  return { columns, rows, columnProfiles };
}

export const UnifiedDataSourceModal: React.FC = () => {
  const {
    projects,
    activeProjectId,
    getActiveProject,
    isDataSourceModalOpen,
    setDataSourceModalOpen,
    addDataSourceToProject,
    addEmbeddedCsvToProject,
    setProjectSchemaCatalog,
    addVirtualRelation,
    removeVirtualRelation,
  } = useProjectStore();

  const {
    activeConnectorId,
    schemaCatalog: dashboardSchemaCatalog,
    fetchConnectors,
    selectConnector,
    fetchSchema,
  } = useDashboardStore();

  const project =
    projects.find((p) => p.id === activeProjectId) || getActiveProject();

  const [activeTab, setActiveTab] = useState<'sources' | 'tables' | 'relations'>(
    'sources'
  );
  const [sourceKind, setSourceKind] = useState<SourcePickerKind>('sqlite');

  // SQL Connection Form State
  const [sqliteMode, setSqliteMode] = useState<'builtin' | 'custom'>('builtin');
  const [sqlitePath, setSqlitePath] = useState('data/insightforge_commerce.db');
  const [connName, setConnName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('1433');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('sa');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Candidate Schema & Table Selection State
  const [candidateCatalog, setCandidateCatalog] =
    useState<SchemaCatalog | null>(null);
  const [pendingSourceMeta, setPendingSourceMeta] = useState<{
    name: string;
    dialect: SQLDialectType;
    connectorId: string;
    host?: string;
    port?: number;
    database: string;
    username?: string;
  } | null>(null);
  const [selectedTableNames, setSelectedTableNames] = useState<string[]>([]);
  const [previewTableName, setPreviewTableName] = useState<string | null>(null);

  // CSV Upload State
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Virtual Relation Builder State
  const [relSourceTable, setRelSourceTable] = useState('');
  const [relSourceColumn, setRelSourceColumn] = useState('');
  const [relTargetTable, setRelTargetTable] = useState('');
  const [relTargetColumn, setRelTargetColumn] = useState('');
  const [relCardinality, setRelCardinality] = useState<
    'N:1' | '1:N' | '1:1' | 'N:M'
  >('N:1');

  // Feedback Banner
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isDataSourceModalOpen) {
      fetchConnectors();
      setStatusMessage(null);
      const existingCatalog = project?.schemaCatalog || dashboardSchemaCatalog;
      if (existingCatalog && !candidateCatalog) {
        setCandidateCatalog(existingCatalog);
        setSelectedTableNames(existingCatalog.tables.map((t) => t.table_name));
        setPreviewTableName(existingCatalog.tables[0]?.table_name || null);
      }
    }
  }, [isDataSourceModalOpen]);

  const handleSelectSourceKind = (kind: SourcePickerKind) => {
    setSourceKind(kind);
    setStatusMessage(null);
    if (kind === 'mssql') {
      setPort('1433');
      setUsername('sa');
    } else if (kind === 'mysql') {
      setPort('3306');
      setUsername('root');
    }
  };

  // Connect to SQL Source -> Load Tables into Step 2
  const handleConnectSqlSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsConnecting(true);
    setStatusMessage(null);

    try {
      if (sourceKind === 'sqlite' && sqliteMode === 'builtin') {
        const cid = 'default_sqlite_commerce';
        let catalog: SchemaCatalog | null = null;
        try {
          const res = await fetch(`/api/connectors/${cid}/schema?refresh=false`);
          if (res.ok) {
            catalog = await res.json();
          }
        } catch {
          // Use existing or sample schema catalog if backend is offline
        }

        if (!catalog) {
          const sampleProj = projects.find((p) => p.id === 'sample-saas-commerce');
          catalog =
            project.schemaCatalog ||
            dashboardSchemaCatalog ||
            sampleProj?.schemaCatalog ||
            null;
        }

        if (catalog) {
          setCandidateCatalog(catalog);
          setSelectedTableNames(catalog.tables.map((t) => t.table_name));
          setPreviewTableName(catalog.tables[0]?.table_name || null);
          setPendingSourceMeta({
            name: 'SaaS & Global Commerce SQLite',
            dialect: 'sqlite',
            connectorId: cid,
            database: 'saas_commerce.db',
          });
          setStatusMessage({
            type: 'success',
            text: `Connected to ${catalog.connector_name} (${catalog.tables.length} tables discovered). Select tables below to include in your project.`,
          });
          setActiveTab('tables');
        }
        return;
      }

      // Custom SQLite, MS SQL Server, or MySQL
      const dialect: SQLDialectType =
        sourceKind === 'mssql'
          ? 'mssql'
          : sourceKind === 'mysql'
          ? 'mysql'
          : 'sqlite';
      const displayName =
        connName.trim() ||
        (dialect === 'sqlite'
          ? `SQLite (${sqlitePath.split('/').pop() || 'local.db'})`
          : `${dialect.toUpperCase()} (${database || host})`);

      const payload = {
        name: displayName,
        dialect,
        sqlite_path: dialect === 'sqlite' ? sqlitePath.trim() : undefined,
        host: dialect !== 'sqlite' ? host.trim() : undefined,
        port: dialect !== 'sqlite' && port ? parseInt(port, 10) : undefined,
        database: dialect !== 'sqlite' ? database.trim() : undefined,
        username: dialect !== 'sqlite' ? username.trim() : undefined,
        password: dialect !== 'sqlite' ? password : undefined,
      };

      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ detail: 'Could not reach database server' }));
        throw new Error(err.detail || 'Database connection failed');
      }

      const created = await res.json();
      await fetchConnectors();
      await selectConnector(created.id);

      const schemaRes = await fetch(
        `/api/connectors/${created.id}/schema?refresh=true`
      );
      if (schemaRes.ok) {
        const catalog: SchemaCatalog = await schemaRes.json();
        setCandidateCatalog(catalog);
        setSelectedTableNames(catalog.tables.map((t) => t.table_name));
        setPreviewTableName(catalog.tables[0]?.table_name || null);
        setPendingSourceMeta({
          name: displayName,
          dialect,
          connectorId: created.id,
          host: dialect !== 'sqlite' ? host.trim() : undefined,
          port: dialect !== 'sqlite' && port ? parseInt(port, 10) : undefined,
          database:
            dialect === 'sqlite'
              ? sqlitePath.trim()
              : database.trim() || 'default',
          username: dialect !== 'sqlite' ? username.trim() : undefined,
        });
        setStatusMessage({
          type: 'success',
          text: `Connected to ${displayName} (${catalog.tables.length} tables profiled). Confirm your table selection below.`,
        });
        setActiveTab('tables');
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Connection failed. Verify server host, port, and credentials.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Apply checked SQL tables to project
  const handleConfirmSelectedTables = () => {
    if (!project || !candidateCatalog) return;
    const chosenTables = candidateCatalog.tables.filter((t) =>
      selectedTableNames.includes(t.table_name)
    );
    const filteredCatalog: SchemaCatalog = {
      ...candidateCatalog,
      tables: chosenTables,
    };

    const sourceConfig: DataSourceConfig = {
      id: `ds-${Date.now()}`,
      name: pendingSourceMeta?.name || candidateCatalog.connector_name,
      dialect: pendingSourceMeta?.dialect || candidateCatalog.dialect,
      connectorId:
        pendingSourceMeta?.connectorId || candidateCatalog.connector_id,
      host: pendingSourceMeta?.host,
      port: pendingSourceMeta?.port,
      database:
        pendingSourceMeta?.database || candidateCatalog.database_display,
      username: pendingSourceMeta?.username,
      selectedTables: chosenTables.map((t) => t.table_name),
      addedAt: new Date().toISOString(),
    };

    addDataSourceToProject(project.id, sourceConfig, filteredCatalog);
    setProjectSchemaCatalog(project.id, filteredCatalog);
    setStatusMessage({
      type: 'success',
      text: `Added ${chosenTables.length} table(s) from ${sourceConfig.name} to project semantic model.`,
    });
  };

  // Multi-file CSV Client-side Parser + Backend SQLite Mount
  const handleCsvFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !project) return;

    setIsImportingCsv(true);
    setStatusMessage(null);
    const importedNames: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const text = await file.text();
        const tableName = sanitizeTableName(file.name);
        const { columns, rows, columnProfiles } = parseCsvText(text);

        if (columns.length === 0) continue;

        const embeddedTable: EmbeddedCsvTable = {
          id: `csv-${Date.now()}-${i}`,
          tableName,
          fileName: file.name,
          rowCount: rows.length,
          columns,
          rows,
          importedAt: new Date().toISOString(),
        };

        const tableProfile: TableProfile = {
          table_name: tableName,
          row_count: rows.length,
          columns: columnProfiles,
          sample_rows: rows.slice(0, 10),
          description: `CSV flat file imported from ${file.name}`,
        };

        addEmbeddedCsvToProject(project.id, embeddedTable, tableProfile);

        // Also register in project.dataSources so mixed sources are tracked
        const csvSourceConfig: DataSourceConfig = {
          id: `ds-csv-${Date.now()}-${i}`,
          name: `CSV: ${file.name}`,
          dialect: 'csv',
          connectorId: project.activeConnectorId || activeConnectorId,
          database: file.name,
          selectedTables: [tableName],
          addedAt: new Date().toISOString(),
        };
        addDataSourceToProject(project.id, csvSourceConfig);

        // Upload to backend active connector so SQL queries can run against it immediately
        try {
          const formData = new FormData();
          formData.append('table_name', tableName);
          formData.append('file', file);
          const targetConnector =
            project.activeConnectorId ||
            activeConnectorId ||
            'default_sqlite_commerce';
          await fetch(`/api/connectors/${targetConnector}/upload-csv`, {
            method: 'POST',
            body: formData,
          });
          await fetchSchema(targetConnector, true);
        } catch {
          // Offline mode: client-side embedded CSV table is already stored in project
        }

        importedNames.push(`${tableName} (${rows.length} rows)`);
      }

      if (importedNames.length > 0) {
        setStatusMessage({
          type: 'success',
          text: `Imported CSV table(s): ${importedNames.join(', ')}. Ready for SQL & Virtual Relations.`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to parse CSV file.',
      });
    } finally {
      setIsImportingCsv(false);
      e.target.value = '';
    }
  };

  // Combine all project tables (SQL + CSV) for Virtual Relations
  const sqlTables = project?.schemaCatalog?.tables || [];
  const csvTables = project?.embeddedCsvTables || [];

  const unifiedTables: Array<{
    tableName: string;
    origin: 'SQL' | 'CSV';
    rowCount: number;
    columns: string[];
  }> = [
    ...sqlTables.map((t) => ({
      tableName: t.table_name,
      origin: 'SQL' as const,
      rowCount: t.row_count,
      columns: t.columns.map((c) => c.name),
    })),
    ...csvTables
      .filter((c) => !sqlTables.some((s) => s.table_name === c.tableName))
      .map((c) => ({
        tableName: c.tableName,
        origin: 'CSV' as const,
        rowCount: c.rowCount,
        columns: c.columns,
      })),
  ];

  useEffect(() => {
    if (unifiedTables.length >= 2) {
      if (!relSourceTable || !unifiedTables.some((t) => t.tableName === relSourceTable)) {
        const first = unifiedTables[0];
        setRelSourceTable(first.tableName);
        setRelSourceColumn(first.columns[0] || '');
      }
      if (!relTargetTable || !unifiedTables.some((t) => t.tableName === relTargetTable)) {
        const second = unifiedTables[1] || unifiedTables[0];
        setRelTargetTable(second.tableName);
        setRelTargetColumn(second.columns[0] || '');
      }
    } else if (unifiedTables.length === 1) {
      const only = unifiedTables[0];
      setRelSourceTable(only.tableName);
      setRelSourceColumn(only.columns[0] || '');
      setRelTargetTable(only.tableName);
      setRelTargetColumn(only.columns[1] || only.columns[0] || '');
    }
  }, [unifiedTables.length]);

  const sourceTableColumns =
    unifiedTables.find((t) => t.tableName === relSourceTable)?.columns || [];
  const targetTableColumns =
    unifiedTables.find((t) => t.tableName === relTargetTable)?.columns || [];

  const handleAddVirtualRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !project ||
      !relSourceTable ||
      !relSourceColumn ||
      !relTargetTable ||
      !relTargetColumn
    ) {
      return;
    }

    addVirtualRelation(project.id, {
      name: `${relSourceTable}.${relSourceColumn} → ${relTargetTable}.${relTargetColumn}`,
      sourceTable: relSourceTable,
      sourceColumn: relSourceColumn,
      targetTable: relTargetTable,
      targetColumn: relTargetColumn,
      relationType: relCardinality,
      isVirtual: true,
    });

    setStatusMessage({
      type: 'success',
      text: `Declared virtual relation: ${relSourceTable}.${relSourceColumn} → ${relTargetTable}.${relTargetColumn} (${relCardinality})`,
    });
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTableNames((prev) =>
      prev.includes(tableName)
        ? prev.filter((n) => n !== tableName)
        : [...prev, tableName]
    );
  };

  const previewTable =
    candidateCatalog?.tables.find((t) => t.table_name === previewTableName) ||
    candidateCatalog?.tables[0] ||
    null;

  return (
    <Dialog open={isDataSourceModalOpen} onOpenChange={setDataSourceModalOpen}>
      <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 text-slate-100 p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-950">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-slate-100">
                  Data Sources & Virtual Schema
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Combine SQLite, MS SQL Server, MySQL, and CSV flat files in one unified semantic model.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-slate-800 bg-slate-900 text-slate-300 text-[11px] font-normal"
              >
                {unifiedTables.length} Tables
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-800 bg-slate-900 text-indigo-300 text-[11px] font-normal"
              >
                {project?.virtualRelations?.length || 0} Relations
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] underline opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as 'sources' | 'tables' | 'relations')
          }
          className="flex flex-col max-h-[78vh]"
        >
          <div className="px-6 pt-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center justify-between">
            <TabsList className="bg-slate-900/90 border border-slate-800/80 h-8 p-0.5">
              <TabsTrigger
                value="sources"
                className="text-xs h-7 px-3 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
              >
                1. Connect Sources (SQL & CSV)
              </TabsTrigger>
              <TabsTrigger
                value="tables"
                className="text-xs h-7 px-3 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
              >
                2. Table Selection & Preview ({candidateCatalog?.tables.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="relations"
                className="text-xs h-7 px-3 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
              >
                3. Relations & Virtual Schema ({project?.virtualRelations?.length || 0})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: SOURCE PICKER (SQLite, MS SQL Server, MySQL, CSV Flat Files) */}
          <TabsContent
            value="sources"
            className="flex-1 overflow-y-auto p-6 space-y-5 mt-0"
          >
            {/* 4 Source Picker Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  {
                    id: 'sqlite',
                    title: 'SQLite',
                    sub: 'Built-in Commerce or .db file',
                    badge: 'Local SQL',
                  },
                  {
                    id: 'mssql',
                    title: 'MS SQL Server',
                    sub: 'Port 1433 • T-SQL Dialect',
                    badge: 'Enterprise',
                  },
                  {
                    id: 'mysql',
                    title: 'MySQL',
                    sub: 'Port 3306 • InnoDB',
                    badge: 'Relational',
                  },
                  {
                    id: 'csv',
                    title: 'CSV / Flat Files',
                    sub: 'Each CSV becomes a table',
                    badge: 'Portable .ifpf',
                  },
                ] as const
              ).map((card) => {
                const selected = sourceKind === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSelectSourceKind(card.id)}
                    className={`rounded-xl border p-3 text-left transition flex flex-col justify-between gap-2 ${
                      selected
                        ? 'border-indigo-500/80 bg-indigo-500/10 text-slate-100'
                        : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100">
                        {card.title}
                      </span>
                      <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0 text-[9px] font-mono text-slate-400">
                        {card.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {card.sub}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Source Specific Form */}
            {sourceKind === 'csv' ? (
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                      Import CSV Flat Files as Relational Tables
                    </h3>
                    <p className="text-xs text-slate-400">
                      Each uploaded <code className="font-mono">.csv</code> file is parsed client-side for portable <code className="font-mono">.ifpf</code> embedding and mounted into SQLite so you can join CSV tables directly with SQL tables.
                    </p>
                  </div>

                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleCsvFilesSelected}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    disabled={isImportingCsv}
                    className="h-8 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                  >
                    {isImportingCsv ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>Select CSV File(s)...</span>
                  </Button>
                </div>

                {/* Currently Imported CSV Tables in Project */}
                {csvTables.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <div className="text-[11px] font-medium text-slate-400">
                      Embedded CSV Tables in Project ({csvTables.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {csvTables.map((csv) => (
                        <div
                          key={csv.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-emerald-300 truncate">
                              {csv.tableName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {csv.fileName} • {csv.rowCount.toLocaleString()} rows •{' '}
                              {csv.columns.length} cols
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]"
                          >
                            CSV
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleConnectSqlSource}
                className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-4"
              >
                {sourceKind === 'sqlite' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSqliteMode('builtin')}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          sqliteMode === 'builtin'
                            ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Built-in SaaS & Global Commerce DB
                      </button>
                      <button
                        type="button"
                        onClick={() => setSqliteMode('custom')}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          sqliteMode === 'custom'
                            ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Custom .db / .sqlite File Path
                      </button>
                    </div>

                    {sqliteMode === 'builtin' ? (
                      <p className="text-xs text-slate-400">
                        Connects to the pre-populated multi-table SaaS & Global Commerce SQLite warehouse (<code className="font-mono text-slate-300">customers</code>, <code className="font-mono text-slate-300">subscriptions</code>, <code className="font-mono text-slate-300">orders</code>, <code className="font-mono text-slate-300">order_items</code>, <code className="font-mono text-slate-300">products</code>, <code className="font-mono text-slate-300">support_tickets</code>).
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Display Name
                          </label>
                          <Input
                            value={connName}
                            onChange={(e) => setConnName(e.target.value)}
                            placeholder="Local Analytics SQLite"
                            className="h-8 bg-slate-950 border-slate-800 text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Database File Path (.db / .sqlite)
                          </label>
                          <Input
                            value={sqlitePath}
                            onChange={(e) => setSqlitePath(e.target.value)}
                            placeholder="data/insightforge_commerce.db"
                            className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Connection Name
                      </label>
                      <Input
                        value={connName}
                        onChange={(e) => setConnName(e.target.value)}
                        placeholder={
                          sourceKind === 'mssql'
                            ? 'Enterprise SQL Server Warehouse'
                            : 'Production MySQL Replica'
                        }
                        className="h-8 bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Host / Server Address
                      </label>
                      <Input
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="localhost or 10.0.0.15"
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Port
                      </label>
                      <Input
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder={sourceKind === 'mssql' ? '1433' : '3306'}
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Database Name
                      </label>
                      <Input
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        placeholder="analytics_dw"
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Username
                      </label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={sourceKind === 'mssql' ? 'sa' : 'root'}
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Password
                      </label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={isConnecting}
                    className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Server className="h-3.5 w-3.5" />
                    )}
                    <span>Connect & Inspect Tables</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Active Project Data Sources Summary */}
            {project && project.dataSources.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Connected Project Sources ({project.dataSources.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {project.dataSources.map((ds) => (
                    <div
                      key={ds.id}
                      className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-slate-800 px-1.5 py-0 font-mono text-[10px] uppercase text-cyan-300">
                            {ds.dialect}
                          </span>
                          <span className="font-medium text-slate-200 truncate">
                            {ds.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {ds.database} • {ds.selectedTables.length} table(s)
                        </div>
                      </div>
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: TABLE SELECTION & COLUMN PREVIEW */}
          <TabsContent
            value="tables"
            className="flex-1 overflow-y-auto p-6 space-y-4 mt-0"
          >
            {!candidateCatalog || candidateCatalog.tables.length === 0 ? (
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-8 text-center space-y-2">
                <Table2 className="h-6 w-6 text-slate-500 mx-auto" />
                <div className="text-xs font-medium text-slate-300">
                  No SQL Tables Loaded Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Connect to a SQLite, MS SQL Server, or MySQL database in Step 1 to browse and select tables for your project.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-indigo-300">
                      {candidateCatalog.dialect}
                    </span>
                    <span className="font-medium text-slate-200">
                      {candidateCatalog.connector_name}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      {selectedTableNames.length} of {candidateCatalog.tables.length}{' '}
                      tables selected
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedTableNames(
                          selectedTableNames.length ===
                            candidateCatalog.tables.length
                            ? []
                            : candidateCatalog.tables.map((t) => t.table_name)
                        )
                      }
                      className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      {selectedTableNames.length === candidateCatalog.tables.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={selectedTableNames.length === 0}
                      onClick={handleConfirmSelectedTables}
                      className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Selected Tables to Project</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left List: Checkable Tables */}
                  <div className="md:col-span-5 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {candidateCatalog.tables.map((tbl) => {
                      const isChecked = selectedTableNames.includes(tbl.table_name);
                      const isPreviewing =
                        previewTable?.table_name === tbl.table_name;
                      return (
                        <div
                          key={tbl.table_name}
                          onClick={() => setPreviewTableName(tbl.table_name)}
                          className={`cursor-pointer rounded-lg border px-3 py-2 flex items-center justify-between gap-2 transition ${
                            isPreviewing
                              ? 'border-indigo-500/60 bg-slate-900'
                              : 'border-slate-800/70 bg-slate-900/30 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleTableSelection(tbl.table_name);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                            />
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-medium text-slate-200 truncate">
                                {tbl.table_name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {tbl.columns.length} columns
                              </div>
                            </div>
                          </div>
                          <span className="rounded bg-slate-950 border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shrink-0">
                            {tbl.row_count.toLocaleString()} rows
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Panel: Selected Table Column Schema Preview */}
                  <div className="md:col-span-7 rounded-lg border border-slate-800/80 bg-slate-900/30 p-3.5 max-h-80 overflow-y-auto space-y-2.5">
                    {previewTable ? (
                      <>
                        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
                          <div className="flex items-center gap-2">
                            <Table2 className="h-3.5 w-3.5 text-cyan-400" />
                            <span className="font-mono text-xs font-semibold text-slate-100">
                              {previewTable.table_name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {previewTable.row_count.toLocaleString()} rows •{' '}
                            {previewTable.columns.length} cols
                          </span>
                        </div>

                        <div className="divide-y divide-slate-800/50">
                          {previewTable.columns.map((col) => (
                            <div
                              key={col.name}
                              className="py-1.5 flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-slate-200 truncate">
                                  {col.name}
                                </span>
                                <span className="rounded bg-slate-950 border border-slate-800 px-1.5 py-0 font-mono text-[10px] text-slate-400">
                                  {col.data_type}
                                </span>
                                {col.is_primary_key && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0 text-[9px] font-medium text-amber-300">
                                    <KeyRound className="h-2.5 w-2.5" /> PK
                                  </span>
                                )}
                                {col.is_foreign_key && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 px-1 py-0 text-[9px] font-mono text-indigo-300">
                                    <Link2 className="h-2.5 w-2.5" /> FK{' '}
                                    {col.foreign_key_target
                                      ? `→ ${col.foreign_key_target}`
                                      : ''}
                                  </span>
                                )}
                              </div>
                              {col.distinct_count !== null && (
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {col.distinct_count} distinct
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 3: VIRTUAL RELATIONS & CROSS-SOURCE SCHEMA BUILDER */}
          <TabsContent
            value="relations"
            className="flex-1 overflow-y-auto p-6 space-y-5 mt-0"
          >
            {/* Declare Virtual Relation Form */}
            <form
              onSubmit={handleAddVirtualRelation}
              className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <GitFork className="h-4 w-4 text-indigo-400" />
                  <span>Declare Virtual Relation (SQL ↔ SQL or CSV ↔ SQL)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Used by BIPlannerAgent & SQLDataAgent for automatic JOIN synthesis
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2.5 items-end">
                {/* Source Table */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Source Table
                  </label>
                  <select
                    value={relSourceTable}
                    onChange={(e) => {
                      const nextTbl = e.target.value;
                      setRelSourceTable(nextTbl);
                      const cols =
                        unifiedTables.find((t) => t.tableName === nextTbl)
                          ?.columns || [];
                      setRelSourceColumn(cols[0] || '');
                    }}
                    className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {unifiedTables.map((t) => (
                      <option key={t.tableName} value={t.tableName}>
                        [{t.origin}] {t.tableName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Column */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Source Column
                  </label>
                  <select
                    value={relSourceColumn}
                    onChange={(e) => setRelSourceColumn(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {sourceTableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cardinality */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Cardinality
                  </label>
                  <select
                    value={relCardinality}
                    onChange={(e) =>
                      setRelCardinality(
                        e.target.value as 'N:1' | '1:N' | '1:1' | 'N:M'
                      )
                    }
                    className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="N:1">Many-to-One (N:1)</option>
                    <option value="1:N">One-to-Many (1:N)</option>
                    <option value="1:1">One-to-One (1:1)</option>
                    <option value="N:M">Many-to-Many (N:M)</option>
                  </select>
                </div>

                {/* Target Table */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Target Table
                  </label>
                  <select
                    value={relTargetTable}
                    onChange={(e) => {
                      const nextTbl = e.target.value;
                      setRelTargetTable(nextTbl);
                      const cols =
                        unifiedTables.find((t) => t.tableName === nextTbl)
                          ?.columns || [];
                      setRelTargetColumn(cols[0] || '');
                    }}
                    className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {unifiedTables.map((t) => (
                      <option key={t.tableName} value={t.tableName}>
                        [{t.origin}] {t.tableName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Column */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Target Column
                  </label>
                  <select
                    value={relTargetColumn}
                    onChange={(e) => setRelTargetColumn(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {targetTableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Submit Button */}
                <div className="sm:col-span-1">
                  <Button
                    type="submit"
                    disabled={unifiedTables.length === 0}
                    className="w-full h-8 px-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </Button>
                </div>
              </div>
            </form>

            {/* Existing Relations List */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Active Model Relationships ({project?.virtualRelations?.length || 0})
              </div>

              {!project?.virtualRelations ||
              project.virtualRelations.length === 0 ? (
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/20 p-4 text-center text-xs text-slate-500">
                  No relationships declared yet. Use the builder above to link columns across your SQL and CSV tables.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {project.virtualRelations.map((rel) => (
                    <div
                      key={rel.id}
                      className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 font-mono">
                        <span className="text-cyan-300 font-medium">
                          {rel.sourceTable}.{rel.sourceColumn}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="text-indigo-300 font-medium">
                          {rel.targetTable}.{rel.targetColumn}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-slate-800 bg-slate-950 text-slate-300 text-[10px] font-mono ml-1"
                        >
                          {rel.relationType}
                        </Badge>
                        {rel.isVirtual && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-normal"
                          >
                            Virtual
                          </Badge>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeVirtualRelation(project.id, rel.id)}
                        title="Remove relation"
                        className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="bg-slate-800/80" />

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            All data source metadata, embedded CSV tables, and virtual relations are saved inside your <code className="font-mono text-slate-400">.ifpf</code> project file.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDataSourceModalOpen(false)}
            className="h-7 px-3 text-xs border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default UnifiedDataSourceModal;
