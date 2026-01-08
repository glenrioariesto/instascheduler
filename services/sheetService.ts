import { AppSettings, ScheduledPost, MediaItem } from '../types';

/**
 * Helper to call the server-side Sheets proxy.
 */
const callSheetsProxy = async (spreadsheetId: string, action: string, payload: any = {}) => {
  const response = await fetch('/api/sheets/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, spreadsheetId, payload })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

export const fetchSheetData = async (settings: AppSettings, tabName?: string): Promise<ScheduledPost[]> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) throw new Error("Missing Google Sheet ID");

  const finalTabName = tabName || 'Schedules';
  const data = await callSheetsProxy(spreadsheetId, 'fetch', { tabName: finalTabName });

  if (!data.values || data.values.length === 0) return [];
  return parseSheetRows(data.values);
};

export const fetchRemoteSettings = async (settings: AppSettings): Promise<any | null> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return null;

  try {
    // Fetch Profiles (now includes ImageKit settings per profile)
    const remoteSettings: any = { profiles: [] };

    try {
      const profilesData = await callSheetsProxy(spreadsheetId, 'fetch', { tabName: 'Profiles' });
      if (profilesData.values) {
        remoteSettings.profiles = profilesData.values
          .filter((row: string[]) => row[0] && row[0].trim() !== '')
          .map((row: string[]) => ({
            id: (row[0] || '').trim(),
            name: (row[1] || '').trim(),
            accountId: (row[2] || '').trim(),
            accessToken: (row[3] || '').trim(),
            sheetTabName: (row[4] || 'Schedules').trim(),
            logsTabName: (row[5] || `Logs - ${row[1]}`).trim(),
            imageKitPublicKey: (row[6] || '').trim(),
            imageKitUrlEndpoint: (row[7] || '').trim(),
            imageKitPrivateKey: (row[8] || '').trim()
          }));
      }
    } catch (e) {
      console.warn("Profiles tab not found, skipping profiles fetch.");
    }

    return remoteSettings;
  } catch (error) {
    console.error("Error fetching remote settings:", error);
    return null;
  }
};

const parseSheetRows = (rows: any[]): ScheduledPost[] => {
  return rows.map((row, index) => {
    const dateStr = row[1];
    const timeStr = row[2]; // New Time Column
    const theme = row[3];
    const title = row[4];
    const caption = row[5];
    const script = row[6];
    const cta = row[7];
    const statusStr = row[8]?.toLowerCase() || 'pending';
    const urlsStr = row[9];

    if (!dateStr) return null;

    const id = `post_${dateStr.replace(/[^a-zA-Z0-9]/g, '')}_${index}`;
    const urls = urlsStr ? urlsStr.split(',').map((s: string) => s.trim()) : [];

    const mediaItems: MediaItem[] = urls.map((url: string, i: number) => {
      const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi|wmv|m4v)$/) || url.includes('video');
      return {
        id: `${id}_slide_${i}`,
        url: url,
        type: isVideo ? 'VIDEO' : 'IMAGE'
      };
    });

    let scheduledTime = new Date().toISOString();
    try {
      // Combine date and time if available
      let dateTimeStr = dateStr;
      if (timeStr) {
        dateTimeStr = `${dateStr}T${timeStr}`;
      }
      scheduledTime = new Date(dateTimeStr).toISOString();
    } catch (e) {
      console.error("Invalid date format:", dateStr, timeStr);
    }

    let status: ScheduledPost['status'] = 'pending';
    if (statusStr === 'published') status = 'published';
    else if (statusStr === 'failed') status = 'failed';

    return {
      id,
      scheduledTime,
      theme: theme || "",
      title: title || "",
      caption: caption || "",
      script: script || "",
      cta: cta || "",
      mediaItems,
      sheetRowIndex: index + 2,
      status
    } as ScheduledPost;
  }).filter((post): post is ScheduledPost => post !== null);
};

export const initializeSpreadsheet = async (accessToken: string, settings: AppSettings): Promise<void> => {
  const { spreadsheetId } = settings;
  await callSheetsProxy(spreadsheetId, 'init', { settings });
};

export const saveLogToSheet = async (settings: AppSettings, log: any): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return;

  let targetTab = settings.logsTabName || 'App Logs';

  // If log has profileId, try to find that profile's log tab
  if (log.profileId) {
    const profile = settings.profiles.find((p: any) => p.id === log.profileId);
    if (profile && profile.logsTabName) {
      targetTab = profile.logsTabName;
    }
  }

  try {
    await callSheetsProxy(spreadsheetId, 'append', {
      tabName: targetTab,
      values: [
        new Date(log.timestamp).toISOString(),
        log.level.toUpperCase(),
        log.message,
        log.details || ''
      ]
    });
  } catch (error) {
    console.error("Failed to save log to sheet:", error);
  }
};

export const saveRemoteSettings = async (settings: AppSettings): Promise<boolean> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return false;

  try {
    await callSheetsProxy(spreadsheetId, 'saveSettings', {
      settings
    });
    return true;
  } catch (error) {
    console.error("Error saving remote settings:", error);
    return false;
  }
};

export const getSchedulerStatus = async (settings: AppSettings): Promise<'ACTIVE' | 'PAUSED'> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return 'ACTIVE';

  try {
    const data = await callSheetsProxy(spreadsheetId, 'fetch', { tabName: 'Settings' });
    if (!data.values) return 'ACTIVE';

    const statusRow = data.values.find((row: string[]) => row[0] === 'SCHEDULER_STATUS');
    return statusRow ? (statusRow[1] as 'ACTIVE' | 'PAUSED') : 'ACTIVE';
  } catch (error) {
    console.error("Error fetching scheduler status:", error);
    return 'ACTIVE';
  }
};

export const setSchedulerStatus = async (settings: AppSettings, status: 'ACTIVE' | 'PAUSED'): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return;

  // We need a way to update a specific key in Settings. 
  // For simplicity, we'll use a new action 'updateSetting' in proxy or just append/update if we can.
  // Since proxy 'saveSettings' overwrites everything or 'updateStatus' is for posts, let's add a generic 'updateSetting' to proxy or reuse 'saveSettings' but that's heavy.
  // Let's assume we can use 'append' if not exists, but updating is harder without row index.
  // Actually, 'saveSettings' in proxy updates A2:B2 with LAST_SYNC.
  // Let's modify proxy to support updating a specific setting key.

  // For now, let's use a specialized call to the proxy to handle this "Upsert" logic for settings.
  // Or simpler: fetch all settings, update one, save all.

  try {
    const remoteSettings = await fetchRemoteSettings(settings);
    // This fetchRemoteSettings in this file returns { profiles }. It doesn't return the raw settings map.
    // We might need to extend fetchRemoteSettings too or just make a new proxy action.

    // Let's use a new proxy action 'setGlobalSetting' which is cleaner.
    await callSheetsProxy(spreadsheetId, 'setGlobalSetting', { key: 'SCHEDULER_STATUS', value: status });
  } catch (error) {
    console.error("Failed to set scheduler status:", error);
    throw error;
  }
};

export const deleteProfileSheets = async (settings: AppSettings, sheetTabName: string, logsTabName?: string): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return;

  try {
    // Delete the Schedules tab
    if (sheetTabName) {
      await callSheetsProxy(spreadsheetId, 'deleteSheet', { tabName: sheetTabName });
    }
    // Delete the Logs tab
    if (logsTabName) {
      await callSheetsProxy(spreadsheetId, 'deleteSheet', { tabName: logsTabName });
    }
  } catch (error) {
    console.error("Failed to delete profile sheets:", error);
    throw error;
  }
};

export const addToSchedule = async (settings: AppSettings, postData: any, tabName?: string): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) throw new Error("Spreadsheet ID not set");

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dateObj = new Date(postData.date);
  const dayName = days[dateObj.getDay()];
  const mediaUrls = postData.mediaItems.map((m: any) => m.url).join(', ');

  await callSheetsProxy(spreadsheetId, 'append', {
    tabName: tabName || 'Schedules',
    values: [
      dayName,
      postData.date,
      postData.time || '', // New Time Column
      postData.theme || '',
      postData.title || '',
      postData.caption || '',
      postData.script || '',
      postData.cta || '',
      'pending',
      mediaUrls
    ]
  });
};

export const updatePostStatus = async (settings: AppSettings, rowIndex: number, status: string, tabName?: string): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return;

  await callSheetsProxy(spreadsheetId, 'updateStatus', {
    tabName: tabName || 'Schedules',
    rowIndex,
    status
  });
};

export const deletePostFromSheet = async (settings: AppSettings, rowIndex: number, tabName?: string): Promise<void> => {
  const { spreadsheetId } = settings;
  if (!spreadsheetId) return;

  await callSheetsProxy(spreadsheetId, 'delete', {
    tabName: tabName || 'Schedules',
    rowIndex
  });
};