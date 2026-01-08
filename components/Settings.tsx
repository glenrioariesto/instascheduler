import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Key, UserCircle, Database, FileSpreadsheet, Lock, CheckCircle2, AlertCircle, PlayCircle, Search, Image as ImageIcon } from 'lucide-react';
import { AppSettings, InstagramProfile } from '../types';
import { initializeSpreadsheet, fetchRemoteSettings, deleteProfileSheets } from '../services/sheetService';
import { getInstagramBusinessId } from '../services/instagramService';
import { useAppStore } from '../store/useAppStore';

// Declare Google Global Type for Typescript (simplified)
declare global {
  interface Window {
    google: any;
  }
}

export const Settings: React.FC = () => {
  const {
    settings,
    setSettings,
    addLog,
    syncSettingsToSheet,
    showAlert,
    showConfirm,
    addProfile,
    updateProfile,
    deleteProfile,
    updateSettings
  } = useAppStore();

  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showToken, setShowToken] = useState(false);
  const [message, setMessage] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string>('Loading...');
  const [isSaving, setIsSaving] = useState(false);

  // Profile Form State
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<Omit<InstagramProfile, 'id'>>({
    name: '',
    accountId: '',
    accessToken: '',
    sheetTabName: 'Schedules',
    logsTabName: 'Logs',
    imageKitPublicKey: '',
    imageKitUrlEndpoint: '',
    imageKitPrivateKey: ''
  });

  useEffect(() => {
    fetch('/api/sheets/info')
      .then(res => res.json())
      .then(data => setServiceAccountEmail(data.email || 'Not configured'))
      .catch(() => setServiceAccountEmail('Error fetching email'));
  }, []);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSettings(formData);
    addLog({ level: 'info', message: 'Application settings updated' });

    try {
      // Sync to sheet
      await syncSettingsToSheet();
      setMessage('Settings saved successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Failed to save settings to sheet.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddOrUpdateProfile = () => {
    if (!profileForm.name || !profileForm.accountId || !profileForm.accessToken) {
      showAlert("Missing Fields", "Please fill in all profile fields.", "error");
      return;
    }

    if (editingProfileId) {
      updateProfile(editingProfileId, profileForm);
      addLog({ level: 'info', message: `Profile updated: ${profileForm.name}`, profileId: editingProfileId });
    } else {
      // We don't have the ID yet for new profiles as it's generated in the store
      // But we can try to find it after adding, or just log generally.
      // Actually, addProfile generates an ID. We should probably return it or handle it differently if we want to log with ID immediately.
      // For now, let's just log the name. The store's addProfile doesn't return the ID.
      addProfile(profileForm);
      addLog({ level: 'info', message: `New profile added: ${profileForm.name}` });
    }

    // Auto-sync to Google Sheet
    setMessage('Syncing to Google Sheet...');
    syncSettingsToSheet().then(success => {
      if (success) {
        setMessage('Profile saved and synced to Google Sheet!');
      } else {
        setMessage('Profile saved locally, but sync to Sheet failed.');
      }
      setTimeout(() => setMessage(''), 3000);
    });

    // Reset form
    setProfileForm({ name: '', accountId: '', accessToken: '', sheetTabName: 'Schedules', logsTabName: 'Logs', imageKitPublicKey: '', imageKitUrlEndpoint: '', imageKitPrivateKey: '' });
    setEditingProfileId(null);
  };

  const handleEditProfile = (profile: InstagramProfile) => {
    setEditingProfileId(profile.id);
    setProfileForm({
      name: profile.name,
      accountId: profile.accountId,
      accessToken: profile.accessToken,
      sheetTabName: profile.sheetTabName,
      logsTabName: profile.logsTabName || '',
      imageKitPublicKey: profile.imageKitPublicKey || '',
      imageKitUrlEndpoint: profile.imageKitUrlEndpoint || '',
      imageKitPrivateKey: profile.imageKitPrivateKey || ''
    });
  };

  const handleFindId = async () => {
    if (!profileForm.accessToken) {
      showAlert("Missing Token", "Please enter the Access Token first.", "error");
      return;
    }

    try {
      setMessage('Searching for Business ID...');
      const id = await getInstagramBusinessId(profileForm.accessToken);
      setProfileForm({ ...profileForm, accountId: id });
      setMessage('ID Found!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      showAlert("Search Failed", `Failed to find ID: ${error.message}`, "error");
      setMessage('');
    }
  };

  const handleTestConnection = async (profile?: InstagramProfile) => {
    if (!formData.spreadsheetId) {
      showAlert("Missing ID", "Please enter a Spreadsheet ID first.", "error");
      return;
    }

    const testTab = profile ? profile.sheetTabName : (formData.settingsTabName || 'Settings');

    try {
      setMessage(`Testing connection to ${testTab}...`);
      const response = await fetch('/api/sheets/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch',
          spreadsheetId: formData.spreadsheetId,
          payload: { tabName: testTab }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessage('Connection Successful!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      showAlert("Connection Failed", `Failed to connect: ${error.message}\n\nMake sure you have shared the spreadsheet with: ${serviceAccountEmail}`, "error");
      setMessage('');
    }
  };

  const handleSetupSheet = async () => {
    if (!formData.spreadsheetId) {
      showAlert("Missing ID", "Please enter a Spreadsheet ID first.", "error");
      return;
    }

    try {
      setMessage('Initializing Spreadsheet structure...');
      await initializeSpreadsheet('', formData);
      setMessage('Spreadsheet initialized successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      showAlert("Setup Failed", `Failed to setup sheet: ${error.message}`, "error");
      setMessage('');
    }
  };

  const handleReloadData = async () => {
    setMessage('Fetching from Sheet...');
    try {
      const remote = await fetchRemoteSettings(settings);
      if (remote) {
        const updates: any = { ...remote, isRemoteConfigured: true };
        const currentIdExists = remote.profiles?.some((p: any) => p.id === settings.activeProfileId);
        if ((!settings.activeProfileId || !currentIdExists) && remote.profiles?.length > 0) {
          updates.activeProfileId = remote.profiles[0].id;
        }
        updateSettings(updates);
        setMessage('Settings reloaded from Sheet!');
      } else {
        setMessage('Failed to fetch from Sheet.');
      }
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Multi-Account Configuration</h2>
            <p className="text-sm text-slate-500">Manage multiple Instagram profiles and global settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Profiles Management */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCircle size={16} /> Instagram Profiles
              </h3>

              {/* Profile Form */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase">{editingProfileId ? 'Edit Profile' : 'Add New Profile'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Profile Name</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        // Auto-generate tab name: Schedules - [Profile Name]
                        // Remove invalid chars for Sheets: * ? : [ ] \ /
                        const sanitized = name.replace(/[*?:\[\]\\\/]/g, '').trim();
                        setProfileForm({
                          ...profileForm,
                          name,
                          sheetTabName: sanitized ? `Schedules - ${sanitized}` : 'Schedules',
                          logsTabName: sanitized ? `Logs - ${sanitized}` : 'Logs'
                        });
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. My Shop Account"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sheet Tab Name</label>
                    <input
                      type="text"
                      value={profileForm.sheetTabName}
                      onChange={(e) => setProfileForm({ ...profileForm, sheetTabName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Schedules_Account1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Instagram Business ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileForm.accountId}
                        onChange={(e) => setProfileForm({ ...profileForm, accountId: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="178414..."
                      />
                      <button
                        type="button"
                        onClick={handleFindId}
                        className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        title="Auto-detect ID"
                      >
                        <Search size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Access Token</label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={profileForm.accessToken}
                        onChange={(e) => setProfileForm({ ...profileForm, accessToken: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="EAAG..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ImageKit Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">ImageKit Public Key</label>
                    <input
                      type="text"
                      value={profileForm.imageKitPublicKey || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, imageKitPublicKey: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="public_..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">ImageKit URL Endpoint</label>
                    <input
                      type="text"
                      value={profileForm.imageKitUrlEndpoint || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, imageKitUrlEndpoint: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://ik.imagekit.io/..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">ImageKit Private Key</label>
                    <input
                      type="password"
                      value={profileForm.imageKitPrivateKey || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, imageKitPrivateKey: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="private_..."
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAddOrUpdateProfile}
                    className="flex-1 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    {editingProfileId ? 'Update Profile' : 'Add Profile'}
                  </button>
                  {editingProfileId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfileId(null);
                        setProfileForm({ name: '', accountId: '', accessToken: '', sheetTabName: 'Schedules', logsTabName: 'Logs', imageKitPublicKey: '', imageKitUrlEndpoint: '', imageKitPrivateKey: '' });
                      }}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Profiles List */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Active Profiles ({formData.profiles.length})</p>
                {formData.profiles.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    No profiles added yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {formData.profiles.map(profile => (
                      <div key={profile.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                            {profile.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{profile.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <FileSpreadsheet size={12} /> {profile.sheetTabName}
                            </p>
                            <p className={`text-[10px] font-bold flex items-center gap-1 ${(!profile.imageKitPublicKey || !profile.imageKitUrlEndpoint || !profile.imageKitPrivateKey) ? 'text-red-500' : 'text-green-600'}`}>
                              <ImageIcon size={10} /> {(!profile.imageKitPublicKey || !profile.imageKitUrlEndpoint || !profile.imageKitPrivateKey) ? 'ImageKit Missing' : 'ImageKit OK'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleTestConnection(profile)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Test Connection"
                          >
                            <PlayCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleEditProfile(profile)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Edit"
                          >
                            <SettingsIcon size={18} />
                          </button>
                          <button
                            onClick={() => {
                              showConfirm(
                                "Delete Profile",
                                `Are you sure you want to delete "${profile.name}"? This will also delete the "${profile.sheetTabName}" and "${profile.logsTabName}" tabs from Google Sheet.`,
                                async () => {
                                  try {
                                    setMessage('Deleting profile and sheets...');
                                    await deleteProfileSheets(settings, profile.sheetTabName, profile.logsTabName);
                                    deleteProfile(profile.id);
                                    await syncSettingsToSheet();
                                    setMessage('Profile and sheets deleted!');
                                    setTimeout(() => setMessage(''), 3000);
                                  } catch (error: any) {
                                    console.error(error);
                                    showAlert("Delete Failed", `Error: ${error.message}`, "error");
                                    setMessage('');
                                  }
                                },
                                "Delete",
                                "Cancel"
                              );
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <AlertCircle size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Global Settings */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Database size={16} /> Google Sheets
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Spreadsheet ID</label>
                  <input
                    type="text"
                    required
                    value={formData.spreadsheetId}
                    onChange={(e) => setFormData({ ...formData, spreadsheetId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="ID..."
                  />
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-blue-600">Service Account Email:</p>
                  <code className="text-[10px] bg-white/50 px-2 py-1 rounded block break-all">{serviceAccountEmail}</code>
                  <div className="pt-2">
                    <p className="text-[10px] text-blue-800 mb-2">
                      1. Add Profiles above.<br />
                      2. Click Initialize to setup tabs.<br />
                      (Deletes 'Sheet1', creates Profile tabs)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSetupSheet}
                        className="w-full py-2 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <PlayCircle size={14} /> Initialize
                      </button>
                      <button
                        type="button"
                        onClick={handleReloadData}
                        className="w-full py-2 bg-slate-600 text-white text-[10px] font-bold rounded hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Database size={14} /> Reload Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100"></div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save All Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {message && (
          <div className="mt-6 p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="text-green-500" />
            {message}
          </div>
        )}
      </div>
    </div>
  );
};