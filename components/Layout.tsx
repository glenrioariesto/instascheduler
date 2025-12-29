import React from 'react';
import { NavLink } from 'react-router-dom';
import { Instagram, LayoutDashboard, ScrollText, Settings as SettingsIcon, PenSquare } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 md:h-screen sticky top-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white p-2 rounded-lg">
            <Instagram size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 tracking-tight">InstaScheduler</h1>
            <p className="text-xs text-slate-500">Pro Edition</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <LayoutDashboard size={20} />
            Scheduler
          </NavLink>

          <NavLink
            to="/manual"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <PenSquare size={20} />
            Manual Post
          </NavLink>

          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <ScrollText size={20} />
            Activity Logs
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <SettingsIcon size={20} />
            Settings
          </NavLink>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100 hidden md:block">
          <div className="text-xs text-slate-400 text-center">
            v1.1.0 &bull; Google Sheets DB
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};