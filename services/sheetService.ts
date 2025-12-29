import { AppSettings, MediaItem, ScheduledPost, RemoteSettings } from "../types";

/**
 * Fetches data from Google Sheets using either OAuth Token (Preferred) or API Key.
 */
export const fetchSheetData = async (settings: AppSettings): Promise<ScheduledPost[]> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) {
    throw new Error("Missing Google Sheet ID");
  }

  // Determine Auth Method
  const tabName = settings.sheetTabName || 'Schedules';
  // Fetch columns A to I (Index 0 to 8)
  // A: Hari, B: Tanggal, C: Tema, D: Judul, E: Caption, F: Script, G: CTA, H: Status, I: Link Posting
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A2:I50`;
  const headers: HeadersInit = {};

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;

  if (isTokenValid) {
    headers['Authorization'] = `Bearer ${googleAccessToken}`;
  } else {
    throw new Error("No valid Auth method found. Please Connect Google Account.");
  }

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (data.error) {
    // Handle auth errors specifically
    if (data.error.code === 401 || data.error.code === 403) {
      throw new Error(`Auth Error: ${data.error.message}. Try reconnecting your Google Account.`);
    }
    throw new Error(`Google Sheets Error: ${data.error.message}`);
  }

  if (!data.values || data.values.length === 0) {
    return [];
  }

  return parseSheetRows(data.values);
};

/**
 * Fetches remote settings from the 'Settings' tab.
 * Expected format: Column A = Key, Column B = Value
 */
export const fetchRemoteSettings = async (settings: AppSettings): Promise<RemoteSettings | null> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) return null;

  // Determine Auth Method
  const tabName = settings.settingsTabName || 'Settings';
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A2:B10`;
  const headers: HeadersInit = {};

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;

  if (isTokenValid) {
    headers['Authorization'] = `Bearer ${googleAccessToken}`;
  } else {
    // If no auth, we can't fetch
    return null;
  }

  try {
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (data.error || !data.values) {
      console.warn("Could not fetch remote settings:", data.error);
      return null;
    }

    const remoteSettings: RemoteSettings = {
      accountId: '',
      accessToken: ''
    };

    data.values.forEach((row: string[]) => {
      const key = row[0]?.trim();
      const value = row[1]?.trim();

      if (key === 'INSTAGRAM_ACCOUNT_ID') remoteSettings.accountId = value;
      if (key === 'INSTAGRAM_ACCESS_TOKEN') remoteSettings.accessToken = value;
      if (key === 'SHEET_TAB_NAME') remoteSettings.sheetTabName = value;
      if (key === 'IMAGEKIT_PUBLIC_KEY') remoteSettings.imageKitPublicKey = value;
      if (key === 'IMAGEKIT_PRIVATE_KEY') remoteSettings.imageKitPrivateKey = value;
      if (key === 'IMAGEKIT_URL_ENDPOINT') remoteSettings.imageKitUrlEndpoint = value;
    });

    return remoteSettings;

  } catch (error) {
    console.error("Error fetching remote settings:", error);
    return null;
  }
};

/**
 * Saves settings back to the 'Settings' tab.
 */
export const saveRemoteSettings = async (settings: AppSettings): Promise<boolean> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt, accountId, accessToken } = settings;

  if (!spreadsheetId || !accountId || !accessToken) return false;

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;
  if (!isTokenValid) return false;

  const tabName = settings.settingsTabName || 'Settings';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A2:B7?valueInputOption=USER_ENTERED`;

  const body = {
    values: [
      ['INSTAGRAM_ACCOUNT_ID', accountId],
      ['INSTAGRAM_ACCESS_TOKEN', accessToken],
      ['SHEET_TAB_NAME', settings.sheetTabName || 'Schedules'],
      ['IMAGEKIT_PUBLIC_KEY', settings.imageKitPublicKey || ''],
      ['IMAGEKIT_PRIVATE_KEY', settings.imageKitPrivateKey || ''],
      ['IMAGEKIT_URL_ENDPOINT', settings.imageKitUrlEndpoint || '']
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) {
      console.error("Error saving remote settings:", data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving remote settings:", error);
    return false;
  }
};

const parseSheetRows = (rows: any[]): ScheduledPost[] => {
  return rows.map((row, index) => {
    // Mapping based on user provided structure:
    // Index 1 (B): Tanggal (Date)
    // Index 4 (E): Caption
    // Index 8 (I): Link Posting (URLs)

    const dateStr = row[1];
    const caption = row[4];
    const statusStr = row[7]?.toLowerCase() || 'pending';
    const urlsStr = row[8];

    // Skip empty rows
    if (!dateStr) return null;

    // Generate ID from Date + Index since there is no explicit ID column
    const id = `post_${dateStr.replace(/[^a-zA-Z0-9]/g, '')}_${index}`;

    const urls = urlsStr ? urlsStr.split(',').map((s: string) => s.trim()) : [];
    // Assume IMAGE by default if not specified (User didn't mention Type column)
    // If needed, we can add logic to guess type from extension or add a Type column mapping later.

    const mediaItems: MediaItem[] = urls.map((url: string, i: number) => {
      const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi|wmv|m4v)$/) || url.includes('video');
      const type = isVideo ? 'VIDEO' : 'IMAGE';
      return {
        id: `${id}_slide_${i}`,
        url: url,
        type: type
      };
    });

    // Basic date parsing
    let scheduledTime = new Date().toISOString();
    try {
      scheduledTime = new Date(dateStr).toISOString();
    } catch (e) {
      console.error("Invalid date format:", dateStr);
    }

    // Validate status
    let status: ScheduledPost['status'] = 'pending';
    if (statusStr === 'published') status = 'published';
    else if (statusStr === 'failed') status = 'failed';

    return {
      id: id,
      scheduledTime: scheduledTime,
      caption: caption || "",
      mediaItems: mediaItems,
      sheetRowIndex: index + 2, // +2 because of 0-index and header row
      status: status
    } as ScheduledPost;
  }).filter((post): post is ScheduledPost => post !== null);
};

/**
 * Initializes an existing Spreadsheet with the required structure.
 * Adds required tabs if they don't exist, and populates headers.
 */
export const initializeSpreadsheet = async (accessToken: string, settings: AppSettings): Promise<void> => {
  const { spreadsheetId } = settings;
  const sheetTabName = settings.sheetTabName || 'Schedules';
  const settingsTabName = settings.settingsTabName || 'Settings';
  const logsTabName = settings.logsTabName || 'Logs';

  // 1. Get current sheets to check what exists
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const getResponse = await fetch(getUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const getData = await getResponse.json();

  if (getData.error) throw new Error(getData.error.message);

  const existingTitles = getData.sheets.map((s: any) => s.properties.title);
  const requests: any[] = [];

  // 2. Add missing sheets
  if (!existingTitles.includes(sheetTabName)) {
    requests.push({ addSheet: { properties: { title: sheetTabName, gridProperties: { frozenRowCount: 1 } } } });
  }
  if (!existingTitles.includes(settingsTabName)) {
    requests.push({ addSheet: { properties: { title: settingsTabName, gridProperties: { frozenRowCount: 1 } } } });
  }
  if (!existingTitles.includes(logsTabName)) {
    requests.push({ addSheet: { properties: { title: logsTabName, gridProperties: { frozenRowCount: 1 } } } });
  }

  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
  }

  // 4. Cleanup Default "Sheet1" (Only if unused)
  // Add a small delay to ensure propagation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // We need to fetch the sheet list again to get the IDs
  const cleanupResponse = await fetch(getUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const cleanupData = await cleanupResponse.json();

  const sheets = cleanupData.sheets;
  const sheet1 = sheets.find((s: any) => s.properties.title === 'Sheet1');

  // Check if Sheet1 exists AND is not being used as one of our custom tabs
  // Also ensure we have other sheets before deleting (safety)
  if (sheet1 && sheets.length > 1) {
    const isUsed =
      sheetTabName === 'Sheet1' ||
      settingsTabName === 'Sheet1' ||
      logsTabName === 'Sheet1';

    if (!isUsed) {
      // Safe to delete
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            { deleteSheet: { sheetId: sheet1.properties.sheetId } }
          ]
        })
      });
    }
  }

  // 3. Populate Headers (Only if empty)
  // Check if A1 is empty for all sheets to avoid overwriting existing data
  const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${sheetTabName}!A1&ranges=${settingsTabName}!A1&ranges=${logsTabName}!A1`;
  const checkResponse = await fetch(checkUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const checkData = await checkResponse.json();

  const sheetA1 = checkData.valueRanges?.[0]?.values?.[0]?.[0];
  const settingsA1 = checkData.valueRanges?.[1]?.values?.[0]?.[0];
  const logsA1 = checkData.valueRanges?.[2]?.values?.[0]?.[0];

  const dataToUpdate = [];

  if (!sheetA1) {
    dataToUpdate.push({
      range: `${sheetTabName}!A1:I1`,
      values: [['Hari', 'Tanggal', 'Tema Konten', 'Judul / Hook', 'Caption', 'Script Singkat', 'CTA', 'Status', 'Link Posting']]
    });
  }

  if (!settingsA1) {
    dataToUpdate.push({
      range: `${settingsTabName}!A1:B1`,
      values: [['Key', 'Value']]
    });
  }

  if (!logsA1) {
    dataToUpdate.push({
      range: `${logsTabName}!A1:D1`,
      values: [['Timestamp', 'Level', 'Message', 'Details']]
    });
  }

  if (dataToUpdate.length > 0) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const updateBody = {
      valueInputOption: 'USER_ENTERED',
      data: dataToUpdate
    };

    await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });
  }
};

/**
 * Appends a log entry to the 'Logs' tab.
 */
export const saveLogToSheet = async (settings: AppSettings, log: any): Promise<void> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) return;

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;
  if (!isTokenValid) return;

  const logsTabName = settings.logsTabName || 'Logs';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${logsTabName}!A:D:append?valueInputOption=USER_ENTERED`;

  const body = {
    values: [
      [
        new Date(log.timestamp).toISOString(),
        log.level.toUpperCase(),
        log.message,
        log.details || ''
      ]
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error("Failed to save log to sheet:", error);
    // Don't throw, just ignore log errors to prevent app crash
  }
};

/**
 * Adds a new post to the Schedule sheet.
 */
export const addToSchedule = async (settings: AppSettings, postData: any): Promise<void> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) throw new Error("Spreadsheet ID not set");

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;
  if (!isTokenValid) throw new Error("Google Account not connected");

  const sheetTabName = settings.sheetTabName || 'Schedules';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTabName}!A:I:append?valueInputOption=USER_ENTERED`;

  // Helper to get Day Name (e.g., Senin)
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dateObj = new Date(postData.date);
  const dayName = days[dateObj.getDay()];

  // Format Media URLs
  const mediaUrls = postData.mediaItems.map((m: any) => m.url).join(', ');

  const body = {
    values: [
      [
        dayName,                // A: Hari
        postData.date,          // B: Tanggal
        postData.theme || '',   // C: Tema
        postData.title || '',   // D: Judul
        postData.caption || '', // E: Caption
        postData.script || '',  // F: Script
        postData.cta || '',     // G: CTA
        'pending',              // H: Status
        mediaUrls               // I: Link Posting
      ]
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
};

/**
 * Updates the status of a specific post in the Google Sheet.
 * Column H is index 7 (A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7)
 */
export const updatePostStatus = async (settings: AppSettings, rowIndex: number, status: string): Promise<void> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) return;

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;
  if (!isTokenValid) throw new Error("Google Account not connected or token expired");

  const sheetTabName = settings.sheetTabName || 'Schedules';
  // Column H is the 8th column
  const range = `${sheetTabName}!H${rowIndex}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const body = {
    values: [[status]]
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error("Failed to update status in sheet:", error);
    throw error;
  }
};

/**
 * Deletes a specific row from the Google Sheet.
 */
export const deletePostFromSheet = async (settings: AppSettings, rowIndex: number): Promise<void> => {
  const { spreadsheetId, googleAccessToken, googleTokenExpiresAt } = settings;

  if (!spreadsheetId) return;

  const isTokenValid = googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt;
  if (!isTokenValid) throw new Error("Google Account not connected or token expired");

  // 1. Get the Sheet ID for the tab name
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const getResponse = await fetch(getUrl, {
    headers: { 'Authorization': `Bearer ${googleAccessToken}` }
  });
  const getData = await getResponse.json();

  const sheetTabName = settings.sheetTabName || 'Schedules';
  const sheet = getData.sheets.find((s: any) => s.properties.title === sheetTabName);

  if (!sheet) throw new Error(`Sheet tab '${sheetTabName}' not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Delete the row
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const body = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1, // 0-indexed
            endIndex: rowIndex
          }
        }
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error("Failed to delete row from sheet:", error);
    throw error;
  }
};