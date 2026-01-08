import React from 'react';
import { Calendar, RefreshCw, Play, LayoutGrid, List, Zap } from 'lucide-react';

interface SchedulerHeaderProps {
  onRunCron: () => void;
  schedulerStatus: 'ACTIVE' | 'PAUSED';
  onToggleStatus: () => void;
  viewMode: 'table' | 'calendar';
  onViewModeChange: (mode: 'table' | 'calendar') => void;
  lastCheck: number | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SchedulerHeader: React.FC<SchedulerHeaderProps> = ({
  onRunCron,
  schedulerStatus,
  onToggleStatus,
  viewMode,
  onViewModeChange,
  lastCheck,
  loading,
  onRefresh
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="text-indigo-600" />
          Content Scheduler
        </h2>
        <p className="text-sm text-slate-500">
          {lastCheck ? `Last sync: ${new Date(lastCheck).toLocaleTimeString()}` : 'Syncing...'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            title="Table View"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            title="Calendar View"
          >
            <LayoutGrid size={18} />
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        <button
          onClick={onToggleStatus}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${schedulerStatus === 'ACTIVE'
            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          title={schedulerStatus === 'ACTIVE' ? "Click to Pause Automation" : "Click to Resume Automation"}
        >
          <div className={`w-2 h-2 rounded-full ${schedulerStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className="font-medium text-sm">{schedulerStatus === 'ACTIVE' ? 'Auto: ON' : 'Auto: OFF'}</span>
        </button>

        <button
          onClick={onRunCron}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap size={18} /> <span className="hidden sm:inline">Test Run</span>
        </button>
      </div>
    </div>
  );
};
