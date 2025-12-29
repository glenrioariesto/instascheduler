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
        remoteSettings.profiles = profilesData.values.map((row: string[]) => ({
          id: row[0],
          name: row[1],
          accountId: row[2],
          accessToken: row[3],
          sheetTabName: row[4] || 'Schedules',
          logsTabName: row[5] || `Logs - ${row[1]}`,
          imageKitPublicKey: row[6] || '',
          imageKitUrlEndpoint: row[7] || ''
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
    const caption = row[4];
    const statusStr = row[7]?.toLowerCase() || 'pending';
    const urlsStr = row[8];

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
      scheduledTime = new Date(dateStr).toISOString();
    } catch (e) {
      console.error("Invalid date format:", dateStr);
    }

    let status: ScheduledPost['status'] = 'pending';
    if (statusStr === 'published') status = 'published';
    else if (statusStr === 'failed') status = 'failed';

    return {
      id,
      scheduledTime,
      caption: caption || "",
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