import React from 'react';
import { LayoutDashboard, Table2, GitBranch } from 'lucide-react';
import { useDashboardStore, type WorkspaceView } from '../../store/useDashboardStore';

export const PowerBiLeftRail: React.FC = () => {
  const { view, setView } = useDashboardStore();

  const items: { id: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { id: 'report', label: 'Report View', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'data', label: 'Data View', icon: <Table2 className="h-4 w-4" /> },
    { id: 'lineage', label: 'Model & Lineage View', icon: <GitBranch className="h-4 w-4" /> },
  ];

  return (
    <aside
      aria-label="Workspace View Switcher"
      className="w-12 bg-chrome border-r border-[#3b3a39] flex flex-col items-center py-2 shrink-0 z-20 select-none"
    >
      <div className="flex flex-col gap-1 w-full px-1.5">
        {items.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              title={item.label}
              className={`h-9 w-9 rounded flex items-center justify-center transition-colors duration-100 ${
                isActive
                  ? 'bg-[#3b3a39] text-white border-l-2 border-brand'
                  : 'text-chrome-muted hover:bg-[#2c2b2a] hover:text-chrome-ink'
              }`}
            >
              {item.icon}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
