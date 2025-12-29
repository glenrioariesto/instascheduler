import React from 'react';
import { Calendar, RefreshCw, Play, Pause, LayoutGrid, List } from 'lucide-react';

interface SchedulerHeaderProps {
  isRunning: boolean;
  onToggleRunning: () => void;
  viewMode: 'table' | 'calendar';
  onViewModeChange: (mode: 'table' | 'calendar') => void;
  lastCheck: number | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SchedulerHeader: React.FC<SchedulerHeaderProps> = ({
  isRunning,
  onToggleRunning,
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
          disabled={loading || isRunning}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        <button
          onClick={onToggleRunning}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all shadow-sm ${isRunning
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-green-600 hover:bg-green-700'
            }`}
        >
          {isRunning ? (
            <> <Pause size={18} /> <span className="hidden sm:inline">Stop</span> </>
          ) : (
            <> <Play size={18} /> <span className="hidden sm:inline">Start Auto</span> </>
          )}
        </button>
      </div>
    </div>
  );
};
