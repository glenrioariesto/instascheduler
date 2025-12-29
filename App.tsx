import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PostForm } from './components/PostForm';
import { Scheduler } from './components/Scheduler';
import { LogViewer } from './components/LogViewer';
import { Settings } from './components/Settings';
import { fetchRemoteSettings } from './services/sheetService';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const { settings, updateSettings, addLog } = useAppStore();

  // Fetch remote settings when local settings change (and are valid)
  useEffect(() => {
    const loadRemoteSettings = async () => {
      if (settings.spreadsheetId) {
        const remoteConfig = await fetchRemoteSettings(settings);
        if (remoteConfig) {
          // Check if anything actually changed to avoid unnecessary updates/logs
          const isSame = JSON.stringify(settings.profiles) === JSON.stringify(remoteConfig.profiles);

          if (isSame) {
            return;
          }

          addLog({ level: 'success', message: 'Loaded settings from Spreadsheet' });

          const updates: any = {
            ...remoteConfig,
            isRemoteConfigured: true
          };

          // If no active profile is set, or current one doesn't exist in remote list, pick the first one
          const currentIdExists = remoteConfig.profiles?.some((p: any) => p.id === settings.activeProfileId);
          if ((!settings.activeProfileId || !currentIdExists) && remoteConfig.profiles?.length > 0) {
            updates.activeProfileId = remoteConfig.profiles[0].id;
          }

          updateSettings(updates);
        }
      }
    };

    loadRemoteSettings();
  }, [settings.spreadsheetId]);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Scheduler />} />
          <Route path="/manual" element={<PostForm />} />
          <Route path="/logs" element={<LogViewer />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;