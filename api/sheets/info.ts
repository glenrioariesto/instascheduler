import { getServerSheetsClient } from '../_services/serverSheetService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return res.status(200).json({ email: 'Not configured (Missing GOOGLE_SERVICE_ACCOUNT_JSON)' });
    }

    const credentials = JSON.parse(serviceAccountJson);
    return res.status(200).json({ email: credentials.client_email });
  } catch (error: any) {
    console.error('Error fetching service account info:', error);
    return res.status(500).json({ error: 'Failed to parse Service Account JSON' });
  }
}
