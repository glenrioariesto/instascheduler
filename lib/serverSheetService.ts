import { google } from 'googleapis';

/**
 * Server-side service to interact with Google Sheets using a Service Account.
 * This is used by Vercel Cron Jobs.
 */
export const getServerSheetsClient = async () => {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable");
  }

  const credentials = JSON.parse(serviceAccountJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

export const fetchServerSheetData = async (spreadsheetId: string, tabName: string = 'Schedules') => {
  const sheets = await getServerSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:I100`,
  });

  return response.data.values || [];
};

export const updateServerPostStatus = async (spreadsheetId: string, tabName: string, rowIndex: number, status: string) => {
  const sheets = await getServerSheetsClient();
  const range = `${tabName}!H${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[status]],
    },
  });
};

export const fetchServerSettings = async (spreadsheetId: string, settingsTabName: string = 'Settings') => {
  const sheets = await getServerSheetsClient();

  // 1. Fetch Global Settings
  const settingsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${settingsTabName}!A2:B10`,
  });

  const settingsRows = settingsResponse.data.values || [];
  const globalSettings: Record<string, string> = {};
  settingsRows.forEach(row => {
    if (row[0] && row[1]) globalSettings[row[0]] = row[1];
  });

  // 2. Fetch Profiles
  let profiles: any[] = [];
  try {
    const profilesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Profiles!A2:I20`, // Support up to 19 profiles with ImageKit per profile
    });
    const profileRows = profilesResponse.data.values || [];
    profiles = profileRows.map((row, index) => ({
      id: row[0] || `profile_${index}`,
      name: row[1] || 'Unnamed Profile',
      accountId: row[2] || '',
      accessToken: row[3] || '',
      sheetTabName: row[4] || 'Schedules',
      logsTabName: row[5] || `Logs - ${row[1] || 'Default'}`,
      imageKitPublicKey: row[6] || '',
      imageKitUrlEndpoint: row[7] || '',
      imageKitPrivateKey: row[8] || ''
    }));
  } catch (e) {
    console.warn("Profiles tab not found or empty, using legacy settings if available.");
    // Fallback for migration: if Profiles tab doesn't exist, use the single account from Settings
    if (globalSettings['INSTAGRAM_ACCOUNT_ID']) {
      profiles = [{
        id: 'legacy',
        name: 'Default Account',
        accountId: globalSettings['INSTAGRAM_ACCOUNT_ID'],
        accessToken: globalSettings['INSTAGRAM_ACCESS_TOKEN'],
        sheetTabName: globalSettings['SHEET_TAB_NAME'] || 'Schedules',
        logsTabName: 'Logs'
      }];
    }
  }

  return { profiles };
};

export const initializeServerSpreadsheet = async (spreadsheetId: string, settings: any) => {
  const sheets = await getServerSheetsClient();
  const settingsTabName = settings.settingsTabName || 'Settings';
  const logsTabName = settings.logsTabName || 'App Logs'; // Default global logs to "App Logs"
  const profilesTabName = 'Profiles';

  // 1. Get existing sheets
  const ss = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = ss.data.sheets || [];
  const existingTitles = existingSheets.map(s => s.properties?.title);

  const requests: any[] = [];

  // Create Core Tabs
  if (!existingTitles.includes(settingsTabName)) requests.push({ addSheet: { properties: { title: settingsTabName } } });
  if (!existingTitles.includes(logsTabName)) requests.push({ addSheet: { properties: { title: logsTabName } } });
  if (!existingTitles.includes(profilesTabName)) requests.push({ addSheet: { properties: { title: profilesTabName } } });

  // Create Profile Tabs (Schedules and Logs)
  if (settings.profiles && Array.isArray(settings.profiles)) {
    settings.profiles.forEach((p: any) => {
      // Schedule Tab
      if (p.sheetTabName && !existingTitles.includes(p.sheetTabName)) {
        // Check if we already added a request for this title in this batch
        const alreadyRequested = requests.some(r => r.addSheet?.properties?.title === p.sheetTabName);
        if (!alreadyRequested) {
          requests.push({ addSheet: { properties: { title: p.sheetTabName } } });
        }
      }
      // Log Tab
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab && !existingTitles.includes(pLogsTab)) {
        const alreadyRequested = requests.some(r => r.addSheet?.properties?.title === pLogsTab);
        if (!alreadyRequested) {
          requests.push({ addSheet: { properties: { title: pLogsTab } } });
        }
      }
    });
  }

  // Execute Creations
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // 2. Delete 'Sheet1' if it exists and we have other tabs
  // Refresh existing sheets after creation
  const ssUpdated = await sheets.spreadsheets.get({ spreadsheetId });
  const updatedSheets = ssUpdated.data.sheets || [];
  const sheet1 = updatedSheets.find(s => s.properties?.title === 'Sheet1');

  if (sheet1 && updatedSheets.length > 1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: sheet1.properties?.sheetId } }]
      }
    });
  }

  // 3. Add headers
  const headerUpdates = [
    { range: `${settingsTabName}!A1:B1`, values: [['Key', 'Value']] },
    { range: `${logsTabName}!A1:D1`, values: [['Timestamp', 'Level', 'Message', 'Details']] },
    { range: `${profilesTabName}!A1:I1`, values: [['Profile ID', 'Name', 'Instagram Account ID', 'Access Token', 'Tab Name', 'Logs Tab Name', 'ImageKit Public Key', 'ImageKit URL Endpoint', 'ImageKit Private Key']] }
  ];

  if (settings.profiles && Array.isArray(settings.profiles)) {
    settings.profiles.forEach((p: any) => {
      if (p.sheetTabName) {
        headerUpdates.push({
          range: `${p.sheetTabName}!A1:I1`,
          values: [['Hari', 'Tanggal', 'Tema Konten', 'Judul / Hook', 'Caption', 'Script Singkat', 'CTA', 'Status', 'Link Posting']]
        });
      }
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab) {
        headerUpdates.push({
          range: `${pLogsTab}!A1:D1`,
          values: [['Timestamp', 'Level', 'Message', 'Details']]
        });
      }
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: headerUpdates
    }
  });
};

export const appendServerRow = async (spreadsheetId: string, tabName: string, values: any[]) => {
  const sheets = await getServerSheetsClient();

  // Check if tab exists, if not create it (especially for Logs)
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A1` });
  } catch (e) {
    // Likely tab doesn't exist
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }]
      }
    });
    // Add header if it's a Log tab
    if (tabName === 'App Logs' || tabName.startsWith('Logs -')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Timestamp', 'Level', 'Message', 'Details']] }
      });
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
};

export const deleteServerRow = async (spreadsheetId: string, tabName: string, rowIndex: number) => {
  const sheets = await getServerSheetsClient();
  const ss = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = ss.data.sheets?.find(s => s.properties?.title === tabName);

  if (!sheet) throw new Error(`Sheet ${tabName} not found`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties?.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }]
    }
  });
};

export const saveServerRemoteSettings = async (spreadsheetId: string, settings: any) => {
  const sheets = await getServerSheetsClient();
  const tabName = settings.settingsTabName || 'Settings';

  // 1. Save Global Settings (only LAST_SYNC, no ImageKit - now stored per profile)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A2:B2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['LAST_SYNC', new Date().toISOString()]
      ]
    }
  });

  // 2. Save Profiles
  if (settings.profiles && settings.profiles.length > 0) {
    // Ensure Profiles tab exists
    const ss = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = ss.data.sheets?.map(s => s.properties?.title) || [];

    if (!existingTitles.includes('Profiles')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Profiles' } } }]
        }
      });
      // Add headers for new Profiles tab
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Profiles!A1:I1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Profile ID', 'Name', 'Instagram Account ID', 'Access Token', 'Tab Name', 'Logs Tab Name', 'ImageKit Public Key', 'ImageKit URL Endpoint', 'ImageKit Private Key']] }
      });
    }

    const profileValues = settings.profiles.map((p: any) => [
      p.id,
      p.name,
      p.accountId,
      p.accessToken,
      p.sheetTabName,
      p.logsTabName || `Logs - ${p.name}`,
      p.imageKitPublicKey || '',
      p.imageKitUrlEndpoint || '',
      p.imageKitPrivateKey || ''
    ]);

    // Clear existing profiles first (optional, but safer to overwrite a range)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Profiles!A2:I20`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Profiles!A2:I${profileValues.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: profileValues
      }
    });

    // Ensure each profile's specific tab exists (Schedule and Logs)
    const requests: any[] = [];
    const headerUpdates: any[] = [];

    settings.profiles.forEach((p: any) => {
      // Schedule Tab
      if (p.sheetTabName && !existingTitles.includes(p.sheetTabName)) {
        const alreadyRequested = requests.some(r => r.addSheet?.properties?.title === p.sheetTabName);
        if (!alreadyRequested) {
          requests.push({ addSheet: { properties: { title: p.sheetTabName } } });
          headerUpdates.push({
            range: `${p.sheetTabName}!A1:I1`,
            values: [['Hari', 'Tanggal', 'Tema Konten', 'Judul / Hook', 'Caption', 'Script Singkat', 'CTA', 'Status', 'Link Posting']]
          });
        }
      }

      // Logs Tab
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab && !existingTitles.includes(pLogsTab)) {
        const alreadyRequested = requests.some(r => r.addSheet?.properties?.title === pLogsTab);
        if (!alreadyRequested) {
          requests.push({ addSheet: { properties: { title: pLogsTab } } });
          headerUpdates.push({
            range: `${pLogsTab}!A1:D1`,
            values: [['Timestamp', 'Level', 'Message', 'Details']]
          });
        }
      }
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }

    if (headerUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: headerUpdates
        }
      });
    }
  }
};
