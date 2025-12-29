import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, LogEntry } from '../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants';
import { saveLogToSheet, saveRemoteSettings } from '../services/sheetService';

interface AppState {
  settings: AppSettings;
  logs: LogEntry[];

  // Actions
  setSettings: (settings: AppSettings) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Async Actions (Wrappers)
  syncSettingsToSheet: () => Promise<boolean>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      logs: [],

      setSettings: (newSettings) => set({ settings: newSettings }),

      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      addLog: (entry) => {
        const newEntry: LogEntry = {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        };

        set((state) => {
          const updatedLogs = [newEntry, ...state.logs].slice(0, 100);
          return { logs: updatedLogs };
        });

        // Side effect: Sync to Sheet if configured
        const { settings } = get();
        if (settings.isRemoteConfigured) {
          saveLogToSheet(settings, newEntry);
        }
      },

      clearLogs: () => set({ logs: [] }),

      syncSettingsToSheet: async () => {
        const { settings, addLog } = get();
        if (settings.spreadsheetId && settings.googleAccessToken) {
          const saved = await saveRemoteSettings(settings);
          if (saved) {
            addLog({ level: 'success', message: 'Settings synced to Google Sheet' });
            return true;
          } else {
            addLog({ level: 'error', message: 'Failed to sync settings to Sheet' });
            return false;
          }
        }
        return false;
      }
    }),
    {
      name: 'instascheduler-storage', // unique name
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings, logs: state.logs }), // Persist these fields
    }
  )
);
