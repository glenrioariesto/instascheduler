import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Key, UserCircle, Database, FileSpreadsheet, Lock, CheckCircle2, AlertCircle, PlayCircle, Search, Image as ImageIcon } from 'lucide-react';
import { AppSettings } from '../types';
import { initializeSpreadsheet } from '../services/sheetService';
import { getInstagramBusinessId } from '../services/instagramService';
import { useAppStore } from '../store/useAppStore';

// Declare Google Global Type for Typescript (simplified)
declare global {
  interface Window {
    google: any;
  }
}

export const Settings: React.FC = () => {
  const { settings, setSettings, addLog, syncSettingsToSheet } = useAppStore();

  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    googleClientId: settings.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    spreadsheetId: settings.spreadsheetId || import.meta.env.VITE_GOOGLE_SHEET_ID || '',
    imageKitPublicKey: settings.imageKitPublicKey || import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || '',
    imageKitPrivateKey: settings.imageKitPrivateKey || import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY || '',
    imageKitUrlEndpoint: settings.imageKitUrlEndpoint || import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '',
  });
  const [showToken, setShowToken] = useState(false);
  const [message, setMessage] = useState('');

  const isGoogleConnected = formData.googleAccessToken && formData.googleTokenExpiresAt && Date.now() < formData.googleTokenExpiresAt;

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(formData);
    addLog({ level: 'info', message: 'Application settings updated' });

    // Sync to sheet
    await syncSettingsToSheet();

    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleGoogleAuth = () => {
    if (!formData.googleClientId) {
      alert("Please enter a Google Client ID first.");
      return;
    }

    if (typeof window.google === 'undefined') {
      alert("Google Identity Services script not loaded. Check internet connection.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: formData.googleClientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.access_token) {
          const expiresIn = tokenResponse.expires_in; // seconds
          const expiresAt = Date.now() + (expiresIn * 1000);

          const newSettings = {
            ...formData,
            googleAccessToken: tokenResponse.access_token,
            googleTokenExpiresAt: expiresAt
          };

          setFormData(newSettings);
          setSettings(newSettings);

          // Save immediately
          await syncSettingsToSheet();

          setMessage('Connected to Google successfully!');
        }
      },
    });

    client.requestAccessToken();
  };

  const handleFindId = async () => {
    if (!formData.accessToken) {
      alert("Please enter your Access Token first.");
      return;
    }

    try {
      setMessage('Searching for Business ID...');
      const id = await getInstagramBusinessId(formData.accessToken);
      setFormData({ ...formData, accountId: id });
      setMessage('ID Found and applied!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to find ID: ${error.message}`);
      setMessage('');
    }
  };

  const handleSetupSheet = async () => {
    if (!formData.spreadsheetId) {
      alert("Please enter a Spreadsheet ID first.");
      return;
    }
    if (!formData.googleAccessToken) {
      alert("Please connect your Google Account first.");
      return;
    }

    try {
      setMessage('Initializing Spreadsheet structure...');
      await initializeSpreadsheet(formData.googleAccessToken, formData);
      setMessage('Spreadsheet initialized successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to setup sheet: ${error.message}`);
      setMessage('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">API Configuration</h2>
            <p className="text-sm text-slate-500">Configure Meta & Google credentials</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Section: Meta / Instagram */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCircle size={16} /> Instagram API
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Instagram Business Account ID
              </label>
              <input
                type="text"
                required
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="e.g. 17841400000000000"
              />
              <button
                type="button"
                onClick={handleFindId}
                className="mt-2 text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Search size={14} />
                Find My ID (Auto-detect)
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Long-Lived Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  required
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="EAAG..."
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100"></div>

          {/* Section: ImageKit */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon size={16} /> ImageKit Storage
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Public Key
                </label>
                <input
                  type="text"
                  value={formData.imageKitPublicKey || ''}
                  onChange={(e) => setFormData({ ...formData, imageKitPublicKey: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="public_..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL Endpoint
                </label>
                <input
                  type="text"
                  value={formData.imageKitUrlEndpoint || ''}
                  onChange={(e) => setFormData({ ...formData, imageKitUrlEndpoint: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="https://ik.imagekit.io/your_id"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Private Key
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={formData.imageKitPrivateKey || ''}
                    onChange={(e) => setFormData({ ...formData, imageKitPrivateKey: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="private_..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100"></div>

          {/* Section: Google Sheets */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database size={16} /> Google Sheets Database
            </h3>

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 border border-blue-100">
              Spreadsheet ID: <b>{formData.spreadsheetId || 'Not set'}</b>
              <br />
              Status: {isGoogleConnected
                ? <span className="font-bold text-green-700">Connected (Private Access)</span>
                : <span className="font-bold text-red-700">Disconnected</span>
              }
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Spreadsheet ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileSpreadsheet size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.spreadsheetId}
                    onChange={(e) => setFormData({ ...formData, spreadsheetId: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="Spreadsheet ID..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSetupSheet}
                  className="mt-2 text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <PlayCircle size={14} />
                  Initialize Sheets & Headers
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Settings Tab Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileSpreadsheet size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.settingsTabName || ''}
                    onChange={(e) => setFormData({ ...formData, settingsTabName: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="e.g. Settings, Config"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Defaults to 'Settings' if empty.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logs Tab Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileSpreadsheet size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.logsTabName || ''}
                    onChange={(e) => setFormData({ ...formData, logsTabName: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="e.g. Logs, Activity"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Defaults to 'Logs' if empty.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sheet Tab Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileSpreadsheet size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.sheetTabName || ''}
                    onChange={(e) => setFormData({ ...formData, sheetTabName: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="e.g. Schedules, Jadwal"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Defaults to 'Schedules' if empty.</p>
              </div>

              <div className="md:col-span-2 pt-2 pb-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Google Client ID (For Private Sheets)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.googleClientId || ''}
                    onChange={(e) => setFormData({ ...formData, googleClientId: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    placeholder="123456...apps.googleusercontent.com"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Create OAuth 2.0 Client ID in Google Cloud Console. Add current URL to "Authorized Javascript Origins".
                </p>
              </div>

              <div className="md:col-span-2">
                {!isGoogleConnected ? (
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors w-full justify-center"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 size={20} />
                      <span className="font-medium">Account Connected</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, googleAccessToken: '', googleTokenExpiresAt: 0 })}
                      className="text-xs text-green-700 underline hover:text-green-900"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>

          {message && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {message}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all"
            >
              <Save size={18} />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};