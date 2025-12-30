import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Instagram, LayoutDashboard, ScrollText, Settings as SettingsIcon, PenSquare, ChevronDown, User, Check, PlusCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Modal } from './ui/Modal';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, setActiveProfile, modal, closeModal } = useAppStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = settings.profiles?.find(p => p.id === settings.activeProfileId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          {/* Custom Profile Switcher */}
          <div className="relative mb-6" ref={dropdownRef}>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Active Account</label>

            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 border rounded-xl transition-all duration-200 group ${isDropdownOpen ? 'border-indigo-300 ring-4 ring-indigo-50 bg-white' : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <User size={16} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {activeProfile?.name || 'Select Profile'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {activeProfile?.accountId || 'No account linked'}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                  {settings.profiles?.length > 0 ? (
                    settings.profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProfile(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${p.id === settings.activeProfileId ? 'bg-indigo-50/50' : ''
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${p.id === settings.activeProfileId ? 'bg-indigo-600' : 'bg-slate-200 text-slate-400'
                            }`}>
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${p.id === settings.activeProfileId ? 'text-indigo-700' : 'text-slate-700'}`}>
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{p.accountId}</p>
                          </div>
                        </div>
                        {p.id === settings.activeProfileId && (
                          <Check size={14} className="text-indigo-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-slate-400 italic">No profiles found</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50 p-2">
                  <Link
                    to="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <PlusCircle size={14} />
                    Manage Profiles
                  </Link>
                </div>
              </div>
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