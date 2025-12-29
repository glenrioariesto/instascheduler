import React from 'react';
import { NavLink } from 'react-router-dom';
import { Instagram, LayoutDashboard, ScrollText, Settings as SettingsIcon, PenSquare } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Modal } from './ui/Modal';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, setActiveProfile, modal, closeModal } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 md:h-screen sticky top-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          {/* Mobile: Logo + Text Combined */}
          <img
            src="/assets/logo-text.png"
            alt="InstaScheduler"
            className="h-8 md:hidden object-contain"
          />

          {/* Desktop: Logo Icon + Text Image */}
          <div className="hidden md:flex items-center gap-3">
            <img
              src="/assets/Logo-InstaScheduler.png"
              alt="Logo"
              className="w-10 h-10 object-contain"
            />
            <img
              src="/assets/InstaScheduler-Text.png"
              alt="InstaScheduler"
              className="h-10 w-48 object-cover"
            />
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {/* Profile Switcher */}
          <div className="px-4 py-3 mb-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Active Account</label>
            {settings.profiles?.length > 0 ? (
              <select
                value={settings.activeProfileId}
                onChange={(e) => setActiveProfile(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {settings.profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-400 italic">No profiles</div>
            )}
          </div>

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

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
      />
    </div>
  );
};