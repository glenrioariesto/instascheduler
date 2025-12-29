import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, LogEntry, InstagramProfile, ModalState } from '../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants';
import { saveLogToSheet, saveRemoteSettings } from '../services/sheetService';

interface AppState {
  settings: AppSettings;
  logs: LogEntry[];
  modal: ModalState;

  // Actions
  setSettings: (settings: AppSettings) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Profile Actions
  addProfile: (profile: Omit<InstagramProfile, 'id'>) => void;
  updateProfile: (id: string, profile: Partial<InstagramProfile>) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;

  // Async Actions (Wrappers)
  syncSettingsToSheet: () => Promise<boolean>;

  // Modal Actions
  showAlert: (title: string, message: string, type?: 'info' | 'success' | 'error') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
  closeModal: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      logs: [],
      modal: {
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
      },

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

      addProfile: (profileData) => {
        const id = crypto.randomUUID();
        const newProfile = { ...profileData, id };
        set((state) => {
          const profiles = [...state.settings.profiles, newProfile];
          const activeProfileId = state.settings.activeProfileId || id;
          return {
            settings: { ...state.settings, profiles, activeProfileId }
          };
        });
      },

      updateProfile: (id, profileData) => {
        set((state) => ({
          settings: {
            ...state.settings,
            profiles: state.settings.profiles.map(p => p.id === id ? { ...p, ...profileData } : p)
          }
        }));
      },

      deleteProfile: (id) => {
        set((state) => {
          const profiles = state.settings.profiles.filter(p => p.id !== id);
          let activeProfileId = state.settings.activeProfileId;
          if (activeProfileId === id) {
            activeProfileId = profiles.length > 0 ? profiles[0].id : '';
          }
          return {
            settings: { ...state.settings, profiles, activeProfileId }
          };
        });
      },

      setActiveProfile: (id) => set((state) => ({
        settings: { ...state.settings, activeProfileId: id }
      })),

      syncSettingsToSheet: async () => {
        const { settings, addLog } = get();
        if (settings.spreadsheetId) {
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
      },

      showAlert: (title, message, type = 'info') => set({
        modal: { isOpen: true, title, message, type }
      }),

      showConfirm: (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => set({
        modal: { isOpen: true, title, message, type: 'confirm', onConfirm, confirmText, cancelText }
      }),

      closeModal: () => set((state) => ({
        modal: { ...state.modal, isOpen: false }
      }))
    }),
    {
      name: 'instascheduler-storage', // unique name
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings, logs: state.logs }), // Persist these fields
      version: 1,
      migrate: (persistedState: any, version) => {
        if (version === 0) {
          // Handle migration from version 0 (undefined) to 1
          // Ensure profiles exists in settings
          if (persistedState.settings && !persistedState.settings.profiles) {
            persistedState.settings.profiles = [];
          }
        }
        return persistedState;
      },
    }
  )
);
