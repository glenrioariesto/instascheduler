import {
  fetchServerSheetData,
  updateServerPostStatus,
  initializeServerSpreadsheet,
  appendServerRow,
  deleteServerRow,
  saveServerRemoteSettings
} from '../_services/serverSheetService';

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

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error(`Proxy error [${action}]:`, error);
    return res.status(500).json({ error: error.message });
  }
}
