import React from 'react';
import { ScrollText, CheckCircle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const LogViewer: React.FC = () => {
  const { logs, clearLogs } = useAppStore();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">Activity Logs</h2>
          <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
            {logs.length}
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="text-slate-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
          title="Clear Logs"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ScrollText size={48} className="mb-2 opacity-20" />
            <p className="text-sm">No logs recorded yet.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border text-sm flex gap-3 ${log.level === 'success' ? 'bg-green-50 border-green-100 text-green-900' :
                log.level === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                  'bg-slate-50 border-slate-100 text-slate-700'
                }`}
            >
              <div className="shrink-0 mt-0.5">
                {log.level === 'success' && <CheckCircle size={16} className="text-green-600" />}
                {log.level === 'error' && <AlertCircle size={16} className="text-red-600" />}
                {log.level === 'info' && <Info size={16} className="text-blue-500" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium">{log.message}</span>
                  <span className="text-xs opacity-60 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs opacity-80 break-all mt-1 font-mono bg-white/50 p-1.5 rounded">
                    {log.details}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};