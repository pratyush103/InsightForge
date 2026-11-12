import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Copy,
  Database,
  Download,
  FileArchive,
  FolderOpen,
  GitFork,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useDashboardStore } from '../store/useDashboardStore';
import type { InsightForgeProject } from '../types/project';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

function formatDialectLabel(dialect: string): string {
  switch (dialect.toLowerCase()) {
    case 'sqlite':
      return 'SQLite';
    case 'mysql':
      return 'MySQL';
    case 'mssql':
      return 'MS SQL';
    case 'csv':
      return 'CSV';
    default:
      return dialect.toUpperCase();
  }
}

function getProjectDialects(project: InsightForgeProject): string[] {
  const set = new Set<string>();
  for (const ds of project.dataSources || []) {
    if (ds.dialect) set.add(formatDialectLabel(ds.dialect));
  }
  if (project.embeddedCsvTables && project.embeddedCsvTables.length > 0) {
    set.add('CSV');
  }
  if (set.size === 0 && project.schemaCatalog?.dialect) {
    set.add(formatDialectLabel(project.schemaCatalog.dialect));
  }
  return Array.from(set);
}

function getProjectStats(project: InsightForgeProject) {
  const tableNames = new Set<string>();
  for (const t of project.schemaCatalog?.tables || []) {
    tableNames.add(t.table_name);
  }
  for (const csv of project.embeddedCsvTables || []) {
    tableNames.add(csv.tableName);
  }
  if (tableNames.size === 0) {
    for (const ds of project.dataSources || []) {
      for (const t of ds.selectedTables || []) {
        tableNames.add(t);
      }
    }
  }

  const visualsCount = (project.pages || []).reduce(
    (sum, page) => sum + (page.widgets?.length || 0),
    0
  );
  const relationsCount = project.virtualRelations?.length || 0;

  return {
    tables: tableNames.size,
    visuals: visualsCount,
    relations: relationsCount,
  };
}

function formatUpdatedTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    projects,
    createBlankProject,
    openProject,
    updateProjectMeta,
    deleteProject,
    duplicateProject,
    importIFPFProject,
    exportIFPFProject,
  } = useProjectStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Rename Modal state
  const [renamingProject, setRenamingProject] = useState<InsightForgeProject | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameDescription, setRenameDescription] = useState('');

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        getProjectDialects(p).some((d) => d.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  const handleCreateBlank = () => {
    useDashboardStore.setState({
      manifest: null,
      layouts: {},
      crossFilter: null,
      agentTraces: [],
      isAnalyzing: false,
    });
    const project = createBlankProject();
    navigate(`/workspace/${project.id}`);
  };

  const handleOpenProject = (projectId: string) => {
    openProject(projectId);
    navigate(`/workspace/${projectId}`);
  };

  const handleFileImport = async (file: File) => {
    setImportError(null);
    setIsImporting(true);
    try {
      const imported = await importIFPFProject(file);
      navigate(`/workspace/${imported.id}`);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to import .ifpf project archive.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileImport(file);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileImport(file);
    }
  };

  const openRenameDialog = (project: InsightForgeProject) => {
    setRenamingProject(project);
    setRenameName(project.name);
    setRenameDescription(project.description);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingProject) return;
    updateProjectMeta(renamingProject.id, {
      name: renameName.trim() || 'Untitled Project',
      description: renameDescription.trim(),
    });
    setRenamingProject(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Hidden File Input for .ifpf Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifpf,.json"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Minimalist Top Navigation Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold tracking-tight text-slate-100">
                InsightForge
              </span>
              <span className="text-slate-700">/</span>
              <span className="text-xs text-slate-400">
                Semantic Models &amp; BI Workspaces
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 text-slate-300 hover:text-slate-100 text-xs"
            >
              <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
              Open .ifpf
            </Button>
            <Button
              size="sm"
              onClick={handleCreateBlank}
              className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              New Blank Project
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 sm:px-10 py-10 space-y-10">
        {/* Hero & Primary Action Tiles */}
        <section className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              Start or Restore a Workspace
            </h1>
            <p className="text-xs text-slate-400">
              Create a blank semantic model across SQL &amp; CSV sources, or open a portable{' '}
              <code className="font-mono text-slate-300">.ifpf</code> project file.
            </p>
          </div>

          {importError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between">
              <span>{importError}</span>
              <button
                onClick={() => setImportError(null)}
                className="text-rose-300 hover:text-white font-medium ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tile 1: Create Blank Project */}
            <Card
              role="button"
              tabIndex={0}
              onClick={handleCreateBlank}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCreateBlank();
                }
              }}
              className="group cursor-pointer border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/75 hover:border-slate-700/80 transition-all duration-150"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-indigo-400 group-hover:border-indigo-500/40 group-hover:text-indigo-300 transition-colors">
                    <Plus className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                </div>
                <CardTitle className="text-sm font-medium text-slate-100 pt-3">
                  Create Blank Project
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Initialize an untitled workspace with a clean canvas. Connect SQLite, MySQL, MS
                  SQL Server, or import CSV files to build your semantic model.
                </CardDescription>
              </CardHeader>
              <CardFooter className="px-5 pb-4 pt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 rounded border border-slate-800/80 bg-slate-950/60 px-2 py-0.5 font-mono text-slate-400">
                  Instant UID
                </span>
                <span>•</span>
                <span>SQL + CSV Hybrid Modeling</span>
              </CardFooter>
            </Card>

            {/* Tile 2: Open Project (.ifpf) */}
            <Card
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              className={`group cursor-pointer border transition-all duration-150 ${
                isDraggingOver
                  ? 'border-indigo-500/70 bg-indigo-500/10'
                  : 'border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/75 hover:border-slate-700/80'
              }`}
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-cyan-400 group-hover:border-cyan-500/40 group-hover:text-cyan-300 transition-colors">
                    <Upload className="h-4 w-4" />
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-800 bg-slate-950/80 text-[10px] font-mono font-normal text-slate-400"
                  >
                    .ifpf / .json
                  </Badge>
                </div>
                <CardTitle className="text-sm font-medium text-slate-100 pt-3">
                  {isImporting ? 'Importing Project Archive...' : 'Open Project (.ifpf)'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Browse or drag and drop an InsightForge Project File to restore data source
                  configs, embedded CSV tables, virtual relations, and chart scopes.
                </CardDescription>
              </CardHeader>
              <CardFooter className="px-5 pb-4 pt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 rounded border border-slate-800/80 bg-slate-950/60 px-2 py-0.5 font-mono text-slate-400">
                  <FileArchive className="h-3 w-3 text-slate-400" />
                  GZIP Portable Format
                </span>
                <span>•</span>
                <span>Click or drop file here</span>
              </CardFooter>
            </Card>
          </div>
        </section>

        <Separator className="bg-slate-800/60" />

        {/* Recent & Saved Projects Section */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-medium text-slate-200">Recent &amp; Saved Projects</h2>
              <Badge
                variant="secondary"
                className="bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-mono px-2 py-0"
              >
                {filteredProjects.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter projects or dialects..."
                  className="h-8 pl-8 pr-3 text-xs bg-slate-900/50 border-slate-800/70 text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-indigo-500/50"
                />
              </div>

              <div className="flex items-center rounded-md border border-slate-800/70 bg-slate-900/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="List view"
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-slate-800/60 bg-slate-900/20 py-14 text-center space-y-3">
              <p className="text-xs text-slate-400">
                No projects match <span className="text-slate-200">"{searchQuery}"</span>.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="h-7 text-xs border-slate-800 bg-slate-900 text-slate-300"
              >
                Clear search
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const dialects = getProjectDialects(project);
                const stats = getProjectStats(project);

                return (
                  <Card
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="group cursor-pointer border-slate-800/60 bg-slate-900/35 hover:bg-slate-900/70 hover:border-slate-700/70 transition-all duration-150 flex flex-col justify-between"
                  >
                    <div>
                      <CardHeader className="p-5 pb-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {project.isSample && (
                              <Badge
                                variant="outline"
                                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-medium px-2 py-0"
                              >
                                Sample
                              </Badge>
                            )}
                            {dialects.length > 0 ? (
                              dialects.map((d) => (
                                <Badge
                                  key={d}
                                  variant="outline"
                                  className="border-slate-800 bg-slate-950/70 text-slate-300 text-[10px] font-mono font-normal px-2 py-0"
                                >
                                  {d}
                                </Badge>
                              ))
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-slate-800/80 bg-slate-950/40 text-slate-500 text-[10px] font-normal px-2 py-0"
                              >
                                Unbound
                              </Badge>
                            )}
                          </div>

                          {/* Quick Actions & Dropdown Menu */}
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Export .ifpf"
                              onClick={() => exportIFPFProject(project.id)}
                              className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 border-slate-800 bg-slate-900 text-slate-200"
                              >
                                <DropdownMenuItem
                                  onClick={() => handleOpenProject(project.id)}
                                  className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                                  Open
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => exportIFPFProject(project.id)}
                                  className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                                >
                                  <Download className="h-3.5 w-3.5 text-slate-400" />
                                  Export .ifpf
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => duplicateProject(project.id)}
                                  className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                                >
                                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openRenameDialog(project)}
                                  className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-800" />
                                <DropdownMenuItem
                                  onClick={() => deleteProject(project.id)}
                                  className="text-xs cursor-pointer text-rose-400 focus:bg-rose-500/15 focus:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <CardTitle className="text-sm font-medium text-slate-100 group-hover:text-white transition-colors line-clamp-1">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                          {project.description || 'No description provided.'}
                        </CardDescription>
                      </CardHeader>
                    </div>

                    <div>
                      <CardContent className="px-5 py-2.5">
                        <div className="flex items-center gap-4 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Table2 className="h-3 w-3 text-slate-500" />
                            <span>{stats.tables} Tables</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <BarChart3 className="h-3 w-3 text-slate-500" />
                            <span>{stats.visuals} Visuals</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <GitFork className="h-3 w-3 text-slate-500" />
                            <span>{stats.relations} Relations</span>
                          </span>
                        </div>
                      </CardContent>

                      <CardFooter className="px-5 py-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Updated {formatUpdatedTime(project.updatedAt)}</span>
                        <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-indigo-300 transition-colors font-medium">
                          Open
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </CardFooter>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((project) => {
                const dialects = getProjectDialects(project);
                const stats = getProjectStats(project);

                return (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="group cursor-pointer rounded-lg border border-slate-800/60 bg-slate-900/35 hover:bg-slate-900/70 hover:border-slate-700/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate">
                          {project.name}
                        </span>
                        {project.isSample && (
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-medium px-2 py-0"
                          >
                            Sample
                          </Badge>
                        )}
                        {dialects.map((d) => (
                          <Badge
                            key={d}
                            variant="outline"
                            className="border-slate-800 bg-slate-950/70 text-slate-300 text-[10px] font-mono font-normal px-2 py-0"
                          >
                            {d}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {project.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 text-xs text-slate-400">
                      <div className="hidden md:flex items-center gap-3 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Database className="h-3 w-3 text-slate-500" />
                          {stats.tables} Tables
                        </span>
                        <span>•</span>
                        <span>{stats.visuals} Visuals</span>
                        <span>•</span>
                        <span>{stats.relations} Relations</span>
                      </div>

                      <span className="text-[11px] text-slate-500 w-20 text-right">
                        {formatUpdatedTime(project.updatedAt)}
                      </span>

                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Export .ifpf"
                          onClick={() => exportIFPFProject(project.id)}
                          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44 border-slate-800 bg-slate-900 text-slate-200"
                          >
                            <DropdownMenuItem
                              onClick={() => handleOpenProject(project.id)}
                              className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => exportIFPFProject(project.id)}
                              className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                            >
                              <Download className="h-3.5 w-3.5 text-slate-400" />
                              Export .ifpf
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => duplicateProject(project.id)}
                              className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                            >
                              <Copy className="h-3.5 w-3.5 text-slate-400" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openRenameDialog(project)}
                              className="text-xs cursor-pointer focus:bg-slate-800 focus:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-400" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem
                              onClick={() => deleteProject(project.id)}
                              className="text-xs cursor-pointer text-rose-400 focus:bg-rose-500/15 focus:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Rename Project Dialog */}
      <Dialog
        open={Boolean(renamingProject)}
        onOpenChange={(open) => {
          if (!open) setRenamingProject(null);
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-slate-100">
              Rename Project
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update the display title and description stored in the project manifest.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Project Name</label>
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Untitled Project"
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Description</label>
              <Input
                value={renameDescription}
                onChange={(e) => setRenameDescription(e.target.value)}
                placeholder="Describe data sources and analytical scope..."
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRenamingProject(null)}
                className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsPage;
