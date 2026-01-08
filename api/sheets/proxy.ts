import { google } from 'googleapis';

// ============== INLINED SERVER SHEET SERVICE ==============
const getServerSheetsClient = async () => {
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

const fetchServerSheetData = async (spreadsheetId: string, tabName: string = 'Schedules') => {
  const sheets = await getServerSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:J100`,
  });
  return response.data.values || [];
};

const updateServerPostStatus = async (spreadsheetId: string, tabName: string, rowIndex: number, status: string) => {
  const sheets = await getServerSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!I${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
};

const appendServerRow = async (spreadsheetId: string, tabName: string, values: any[]) => {
  const sheets = await getServerSheetsClient();
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A1` });
  } catch (e) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
    });
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
    range: `${tabName}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
};

const deleteServerRow = async (spreadsheetId: string, tabName: string, rowIndex: number) => {
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

const initializeServerSpreadsheet = async (spreadsheetId: string, settings: any) => {
  const sheets = await getServerSheetsClient();
  const settingsTabName = settings.settingsTabName || 'Settings';
  const logsTabName = settings.logsTabName || 'App Logs';
  const profilesTabName = 'Profiles';

  const ss = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = ss.data.sheets || [];
  const existingTitles = existingSheets.map(s => s.properties?.title);

  const requests: any[] = [];
  if (!existingTitles.includes(settingsTabName)) requests.push({ addSheet: { properties: { title: settingsTabName } } });
  if (!existingTitles.includes(logsTabName)) requests.push({ addSheet: { properties: { title: logsTabName } } });
  if (!existingTitles.includes(profilesTabName)) requests.push({ addSheet: { properties: { title: profilesTabName } } });

  if (settings.profiles && Array.isArray(settings.profiles)) {
    settings.profiles.forEach((p: any) => {
      if (p.sheetTabName && !existingTitles.includes(p.sheetTabName)) {
        if (!requests.some(r => r.addSheet?.properties?.title === p.sheetTabName)) {
          requests.push({ addSheet: { properties: { title: p.sheetTabName } } });
        }
      }
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab && !existingTitles.includes(pLogsTab)) {
        if (!requests.some(r => r.addSheet?.properties?.title === pLogsTab)) {
          requests.push({ addSheet: { properties: { title: pLogsTab } } });
        }
      }
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  const ssUpdated = await sheets.spreadsheets.get({ spreadsheetId });
  const updatedSheets = ssUpdated.data.sheets || [];
  const sheet1 = updatedSheets.find(s => s.properties?.title === 'Sheet1');
  if (sheet1 && updatedSheets.length > 1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteSheet: { sheetId: sheet1.properties?.sheetId } }] }
    });
  }

  const headerUpdates: any[] = [
    { range: `${settingsTabName}!A1:B1`, values: [['Key', 'Value']] },
    { range: `${logsTabName}!A1:D1`, values: [['Timestamp', 'Level', 'Message', 'Details']] },
    { range: `${profilesTabName}!A1:I1`, values: [['Profile ID', 'Name', 'Instagram Account ID', 'Access Token', 'Tab Name', 'Logs Tab Name', 'ImageKit Public Key', 'ImageKit URL Endpoint', 'ImageKit Private Key']] }
  ];
  if (settings.profiles && Array.isArray(settings.profiles)) {
    settings.profiles.forEach((p: any) => {
      if (p.sheetTabName) {
        headerUpdates.push({ range: `${p.sheetTabName}!A1:J1`, values: [['Hari', 'Tanggal', 'Jam', 'Tema Konten', 'Judul / Hook', 'Caption', 'Script Singkat', 'CTA', 'Status', 'Link Posting']] });
      }
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab) {
        headerUpdates.push({ range: `${pLogsTab}!A1:D1`, values: [['Timestamp', 'Level', 'Message', 'Details']] });
      }
    });
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: headerUpdates } });
};

const saveServerRemoteSettings = async (spreadsheetId: string, settings: any) => {
  const sheets = await getServerSheetsClient();
  const tabName = settings.settingsTabName || 'Settings';

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

  if (settings.profiles && settings.profiles.length > 0) {
    const ss = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = ss.data.sheets?.map(s => s.properties?.title) || [];

    if (!existingTitles.includes('Profiles')) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: 'Profiles' } } }] } });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `Profiles!A1:I1`, valueInputOption: 'USER_ENTERED', requestBody: { values: [['Profile ID', 'Name', 'Instagram Account ID', 'Access Token', 'Tab Name', 'Logs Tab Name', 'ImageKit Public Key', 'ImageKit URL Endpoint', 'ImageKit Private Key']] } });
    }

    const profileValues = settings.profiles.map((p: any) => [p.id, p.name, p.accountId, p.accessToken, p.sheetTabName, p.logsTabName || `Logs - ${p.name}`, p.imageKitPublicKey || '', p.imageKitUrlEndpoint || '', p.imageKitPrivateKey || '']);
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `Profiles!A2:I20` });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `Profiles!A2:I${profileValues.length + 1}`, valueInputOption: 'USER_ENTERED', requestBody: { values: profileValues } });

    const requests: any[] = [];
    const headerUpdates: any[] = [];
    settings.profiles.forEach((p: any) => {
      if (p.sheetTabName && !existingTitles.includes(p.sheetTabName)) {
        if (!requests.some(r => r.addSheet?.properties?.title === p.sheetTabName)) {
          requests.push({ addSheet: { properties: { title: p.sheetTabName } } });
          headerUpdates.push({ range: `${p.sheetTabName}!A1:J1`, values: [['Hari', 'Tanggal', 'Jam', 'Tema Konten', 'Judul / Hook', 'Caption', 'Script Singkat', 'CTA', 'Status', 'Link Posting']] });
        }
      }
      const pLogsTab = p.logsTabName || `Logs - ${p.name}`;
      if (pLogsTab && !existingTitles.includes(pLogsTab)) {
        if (!requests.some(r => r.addSheet?.properties?.title === pLogsTab)) {
          requests.push({ addSheet: { properties: { title: pLogsTab } } });
          headerUpdates.push({ range: `${pLogsTab}!A1:D1`, values: [['Timestamp', 'Level', 'Message', 'Details']] });
        }
      }
    });
    if (requests.length > 0) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    if (headerUpdates.length > 0) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: headerUpdates } });
  }
};

const setServerGlobalSetting = async (spreadsheetId: string, key: string, value: string, settingsTabName: string = 'Settings') => {
  const sheets = await getServerSheetsClient();

  // 1. Get all data from Settings tab
  let rows: any[] = [];
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${settingsTabName}!A:B` });
    rows = response.data.values || [];
  } catch (e) {
    // Tab might not exist, create it
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: settingsTabName } } }] }
    });
    rows = [['Key', 'Value']]; // Init header
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${settingsTabName}!A1:B1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rows[0]] }
    });
  }

  // 2. Find if key exists (use trim to handle whitespace)
  const rowIndex = rows.findIndex(r => r[0]?.trim() === key.trim());

  if (rowIndex !== -1) {
    // Update existing
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${settingsTabName}!B${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] }
    });
  } else {
    // Append new
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${settingsTabName}!A:B`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[key, value]] }
    });
  }
};

const deleteServerSheet = async (spreadsheetId: string, tabName: string) => {
  const sheets = await getServerSheetsClient();

  // First, get the sheet ID by name
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === tabName);

  if (!sheet) {
    console.warn(`Sheet "${tabName}" not found, skipping deletion.`);
    return; // Sheet doesn't exist, nothing to delete
  }

  const sheetId = sheet.properties?.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteSheet: { sheetId } }]
    }
  });
  console.log(`Deleted sheet: ${tabName}`);
};
// ============== END INLINED SERVICE ==============

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, spreadsheetId, payload } = req.body;

  if (!spreadsheetId) {
    return res.status(400).json({ error: 'Missing Spreadsheet ID' });
  }

  try {
    switch (action) {
      case 'fetch':
        const rows = await fetchServerSheetData(spreadsheetId, payload.tabName);
        return res.status(200).json({ values: rows });

      case 'updateStatus':
        await updateServerPostStatus(spreadsheetId, payload.tabName, payload.rowIndex, payload.status);
        return res.status(200).json({ success: true });

      case 'append':
        await appendServerRow(spreadsheetId, payload.tabName, payload.values);
        return res.status(200).json({ success: true });

      case 'delete':
        await deleteServerRow(spreadsheetId, payload.tabName, payload.rowIndex);
        return res.status(200).json({ success: true });

      case 'init':
        await initializeServerSpreadsheet(spreadsheetId, payload.settings);
        return res.status(200).json({ success: true });

      case 'saveSettings':
        await saveServerRemoteSettings(spreadsheetId, payload.settings);
        return res.status(200).json({ success: true });

      case 'setGlobalSetting':
        await setServerGlobalSetting(spreadsheetId, payload.key, payload.value);
        return res.status(200).json({ success: true });

      case 'deleteSheet':
        await deleteServerSheet(spreadsheetId, payload.tabName);
        return res.status(200).json({ success: true });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error(`Proxy error [${action}]:`, error);
    return res.status(500).json({ error: error.message });
  }
}
