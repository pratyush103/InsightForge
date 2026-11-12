import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  Download,
  FileCode2,
  FilePlus2,
  FilterX,
  FolderOpen,
  GitBranch,
  GitFork,
  LayoutGrid,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';

export const WorkspaceRibbon: React.FC = () => {
  const navigate = useNavigate();

  const {
    projects,
    activeProjectId,
    getActiveProject,
    createBlankProject,
    updateProjectMeta,
    importIFPFProject,
    exportIFPFProject,
    syncDashboardToProject,
    setDataSourceModalOpen,
    setERDiagramModalOpen,
  } = useProjectStore();

  const {
    manifest,
    layouts,
    layoutPreset,
    crossFilter,
    isAnalyzing,
    switchLayoutPreset,
    replayCurrentPipeline,
    setPipelineDrawerOpen,
    setCrossFilter,
  } = useDashboardStore();

  const project =
    projects.find((p) => p.id === activeProjectId) || getActiveProject();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project?.name || 'Untitled Project');
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (project?.name && !isEditingTitle) {
      setTitleDraft(project.name);
    }
  }, [project?.name, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitleChange = () => {
    setIsEditingTitle(false);
    if (!project) return;
    const trimmed = titleDraft.trim() || 'Untitled Project';
    setTitleDraft(trimmed);
    if (trimmed !== project.name) {
      updateProjectMeta(project.id, { name: trimmed });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitleChange();
    } else if (e.key === 'Escape') {
      setTitleDraft(project?.name || 'Untitled Project');
      setIsEditingTitle(false);
    }
  };

  const handleNewBlankProject = () => {
    useDashboardStore.setState({
      manifest: null,
      layouts: {},
      crossFilter: null,
      agentTraces: [],
      isAnalyzing: false,
    });
    const created = createBlankProject('Untitled Project');
    navigate(`/workspace/${created.id}`);
  };

  const handleTriggerOpenIFPF = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importIFPFProject(file);
      navigate(`/workspace/${imported.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to open .ifpf file');
      setTimeout(() => setImportError(null), 4000);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveProject = () => {
    if (!project) return;
    syncDashboardToProject(project.id, {
      manifest,
      widgets: manifest?.widgets,
      layouts,
      layoutPreset,
      crossFilter,
    });
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2200);
  };

  const handleExportIFPF = async () => {
    if (!project) return;
    handleSaveProject();
    await exportIFPFProject(project.id);
  };

  const handleExportPythonPipeline = async () => {
    if (!manifest?.pipeline_id) return;
    try {
      const res = await fetch(`/api/pipelines/${manifest.pipeline_id}/export/python`);
      if (res.ok) {
        const scriptText = await res.text();
        const blob = new Blob([scriptText], { type: 'text/x-python;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manifest.pipeline_id}.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return;
      }
    } catch {
      // Fallback: synthesize reproducible Python script client-side if offline
    }
    const stepsCode = (manifest.steps || [])
      .map(
        (s) =>
          `# Step ${s.step_number}: ${s.title}\nquery_${s.step_number} = """${
            s.executed_sql || s.sql_query || ''
          }"""`
      )
      .join('\n\n');
    const fallbackPy = `"""\nInsightForge Reproducible BI Pipeline\nPipeline ID: ${manifest.pipeline_id}\nQuery: ${manifest.user_query}\n"""\n\n${stepsCode}\n`;
    const blob = new Blob([fallbackPy], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.pipeline_id}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleSwitchPreset = async (preset: 'executive' | 'bento' | 'compact') => {
    await switchLayoutPreset(preset);
    if (project) {
      const latestLayouts = useDashboardStore.getState().layouts;
      syncDashboardToProject(project.id, {
        layoutPreset: preset,
        layouts: latestLayouts,
      });
    }
  };

  const totalTables =
    (project?.schemaCatalog?.tables?.length || 0) +
    (project?.embeddedCsvTables?.length || 0);
  const totalRelations = project?.virtualRelations?.length || 0;

  return (
    <TooltipProvider delayDuration={180}>
      <header className="shrink-0 border-b border-slate-800/60 bg-slate-950 select-none z-30">
        {/* Hidden file input for .ifpf import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".ifpf,.json"
          onChange={handleFileImport}
          className="hidden"
        />

        <div className="h-11 px-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* Left Section: Back + Brand + Editable Project Title + Classical Top Menus */}
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/projects')}
                  className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Back to Projects
              </TooltipContent>
            </Tooltip>

            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>

            {/* Inline-Editable Project Title */}
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleChange}
                onKeyDown={handleTitleKeyDown}
                className="h-7 w-48 sm:w-56 bg-slate-900 border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-100 focus-visible:ring-1 focus-visible:ring-indigo-500"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename project"
                className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900/80 transition max-w-[200px] sm:max-w-[240px]"
              >
                <span className="truncate">{project?.name || 'Untitled Project'}</span>
                <Pencil className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}

            <Separator orientation="vertical" className="h-4 bg-slate-800/80 mx-1" />

            {/* Classical Top Menu: File */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-900 data-[state=open]:bg-slate-900 data-[state=open]:text-slate-100 gap-1"
                >
                  File
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-56 bg-slate-950 border-slate-800 text-slate-200 shadow-2xl"
              >
                <DropdownMenuLabel className="text-[11px] font-medium text-slate-500 px-2 py-1">
                  Project Workspace
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={handleNewBlankProject}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <FilePlus2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>New Blank Project</span>
                  <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleTriggerOpenIFPF}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                  <span>Open Project (.ifpf)...</span>
                  <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSaveProject}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5 text-slate-400" />
                  <span>Save Project</span>
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-800/80" />

                <DropdownMenuItem
                  onClick={handleExportIFPF}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Export Project (.ifpf)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportPythonPipeline}
                  disabled={!manifest}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Export Python Pipeline (.py)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-800/80" />

                <DropdownMenuItem
                  onClick={() => window.print()}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                  <span>Print / Export PDF</span>
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-800/80" />

                <DropdownMenuItem
                  onClick={() => navigate('/projects')}
                  className="text-xs text-rose-300 focus:bg-rose-950/40 focus:text-rose-200 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400" />
                  <span>Close Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Classical Top Menu: Home */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-900 data-[state=open]:bg-slate-900 data-[state=open]:text-slate-100 gap-1"
                >
                  Home
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-56 bg-slate-950 border-slate-800 text-slate-200 shadow-2xl"
              >
                <DropdownMenuLabel className="text-[11px] font-medium text-slate-500 px-2 py-1">
                  Data & Modeling
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setDataSourceModalOpen(true)}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Add Data Source (SQL / CSV)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setERDiagramModalOpen(true)}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <GitFork className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Data Model / ER Diagram</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-800/80" />
                <DropdownMenuLabel className="text-[11px] font-medium text-slate-500 px-2 py-1">
                  Canvas & Execution
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleSwitchPreset('executive')}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                  <span>Preset: Executive Layout</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSwitchPreset('bento')}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                  <span>Preset: Bento Grid</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSwitchPreset('compact')}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                  <span>Preset: Compact 3-Col</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800/80" />
                <DropdownMenuItem
                  onClick={replayCurrentPipeline}
                  disabled={!manifest || isAnalyzing}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Replay Deterministic Pipeline</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setPipelineDrawerOpen(true)}
                  disabled={!manifest}
                  className="text-xs text-slate-200 focus:bg-slate-900 focus:text-white cursor-pointer"
                >
                  <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Inspect Execution DAG</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Center / Right Integrated Sleek Ribbon Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {importError && (
              <Badge
                variant="outline"
                className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-[11px] font-normal py-0.5"
              >
                {importError}
              </Badge>
            )}

            {/* Active Cross-Filter Pill */}
            {crossFilter && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-200">
                <span className="text-slate-400">Filter:</span>
                <code className="font-mono font-medium text-indigo-100">
                  {crossFilter.column} = {crossFilter.value}
                </code>
                <button
                  type="button"
                  onClick={() => setCrossFilter(null)}
                  title="Clear cross-filter"
                  className="ml-0.5 rounded p-0.5 text-indigo-300 hover:bg-indigo-500/25 hover:text-white transition"
                >
                  <FilterX className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Add Data Source */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDataSourceModalOpen(true)}
                  className="h-7 px-2.5 text-xs font-medium bg-slate-900/60 border-slate-800/80 text-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-700 gap-1.5"
                >
                  <div className="relative flex items-center">
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    <Plus className="h-2.5 w-2.5 text-cyan-300 -ml-1 -mt-1.5" />
                  </div>
                  <span>Add Data Source</span>
                  {totalTables > 0 && (
                    <span className="rounded bg-slate-800/90 px-1.5 py-0 text-[10px] font-mono text-slate-400">
                      {totalTables}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Connect SQLite, MS SQL, MySQL, or upload CSV tables
              </TooltipContent>
            </Tooltip>

            {/* Data Model / ER Diagram */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setERDiagramModalOpen(true)}
                  className="h-7 px-2.5 text-xs font-medium bg-slate-900/60 border-slate-800/80 text-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-700 gap-1.5"
                >
                  <GitFork className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Data Model</span>
                  {totalRelations > 0 && (
                    <span className="rounded bg-slate-800/90 px-1.5 py-0 text-[10px] font-mono text-slate-400">
                      {totalRelations} rel
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Visualise Entity-Relationship Diagram & Virtual Relations
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 bg-slate-800/80 mx-0.5" />

            {/* Layout Presets Segmented Control */}
            <div className="inline-flex items-center rounded-md border border-slate-800/80 bg-slate-900/50 p-0.5 text-[11px]">
              {(
                [
                  { id: 'executive', label: 'Executive' },
                  { id: 'bento', label: 'Bento' },
                  { id: 'compact', label: 'Compact' },
                ] as const
              ).map((preset) => {
                const active = layoutPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSwitchPreset(preset.id)}
                    className={`rounded px-2 py-0.5 font-medium transition ${
                      active
                        ? 'bg-slate-800 text-slate-100 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <Separator orientation="vertical" className="h-4 bg-slate-800/80 mx-0.5" />

            {/* Replay Pipeline Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={replayCurrentPipeline}
                  disabled={!manifest || isAnalyzing}
                  className="h-7 px-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-900 gap-1.5 disabled:opacity-40"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className="hidden lg:inline">Replay</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Replay SQL pipeline deterministically
              </TooltipContent>
            </Tooltip>

            {/* Execution DAG Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPipelineDrawerOpen(true)}
                  disabled={!manifest}
                  className="h-7 px-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-900 gap-1.5 disabled:opacity-40"
                >
                  <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden lg:inline">DAG</span>
                  {manifest?.steps?.length ? (
                    <span className="rounded bg-slate-800 px-1.5 py-0 text-[10px] font-mono text-slate-400">
                      {manifest.steps.length}
                    </span>
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Inspect reproducible SQL execution DAG & SHA-256 lineage
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 bg-slate-800/80 mx-0.5" />

            {/* Save / Export Status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveProject}
                  className="h-7 px-2 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900 gap-1.5"
                >
                  {saveFeedback ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Save</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs px-2.5 py-1"
              >
                Save workspace changes to project
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
};
export default WorkspaceRibbon;
