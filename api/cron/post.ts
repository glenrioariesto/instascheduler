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
    range: `${tabName}!A2:I100`,
  });
  return response.data.values || [];
};

const updateServerPostStatus = async (spreadsheetId: string, tabName: string, rowIndex: number, status: string) => {
  const sheets = await getServerSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!H${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
};

const fetchServerSettings = async (spreadsheetId: string, settingsTabName: string = 'Settings') => {
  const sheets = await getServerSheetsClient();
  const settingsResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${settingsTabName}!A2:B10` });
  const settingsRows = settingsResponse.data.values || [];
  const globalSettings: Record<string, string> = {};
  settingsRows.forEach(row => { if (row[0] && row[1]) globalSettings[row[0]] = row[1]; });

  let profiles: any[] = [];
  try {
    const profilesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `Profiles!A2:H20` });
    const profileRows = profilesResponse.data.values || [];
    profiles = profileRows.map((row, index) => ({
      id: row[0] || `profile_${index}`,
      name: row[1] || 'Unnamed Profile',
      accountId: row[2] || '',
      accessToken: row[3] || '',
      sheetTabName: row[4] || 'Schedules',
      logsTabName: row[5] || `Logs - ${row[1] || 'Default'}`,
      imageKitPublicKey: row[6] || '',
      imageKitUrlEndpoint: row[7] || ''
    }));
  } catch (e) {
    console.warn("Profiles tab not found, using legacy settings if available.");
    if (globalSettings['INSTAGRAM_ACCOUNT_ID']) {
      profiles = [{ id: 'legacy', name: 'Default Account', accountId: globalSettings['INSTAGRAM_ACCOUNT_ID'], accessToken: globalSettings['INSTAGRAM_ACCESS_TOKEN'], sheetTabName: globalSettings['SHEET_TAB_NAME'] || 'Schedules', logsTabName: 'Logs', imageKitPublicKey: '', imageKitUrlEndpoint: '' }];
    }
  }
  return { profiles };
};
// ============== END INLINED SHEET SERVICE ==============

// ============== INLINED INSTAGRAM SERVICE ==============
const BASE_URL = "https://graph.facebook.com/v24.0";

interface MediaItem { id: string; url: string; type: 'IMAGE' | 'VIDEO'; }

const publishCarouselPost = async (accountId: string, accessToken: string, caption: string, mediaItems: MediaItem[], onProgress: (status: string) => void): Promise<string> => {
  if (!accountId || !accessToken) throw new Error("Missing Account ID or Access Token");
  if (mediaItems.length === 0) throw new Error("No media items provided");
  if (mediaItems.length > 10) throw new Error("Instagram carousels support a maximum of 10 items");

  const handleResponse = async (res: Response, stage: string) => {
    const data = await res.json();
    if (data.error) throw new Error(`Instagram API Error [${stage}]: ${data.error.message}${data.error.error_user_msg ? ' - ' + data.error.error_user_msg : ''}`);
    return data;
  };

  const waitForContainer = async (containerId: string, maxRetries = 20): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(`${BASE_URL}/${containerId}?fields=status_code&access_token=${accessToken}`);
      const data = await res.json();
      if (data.error) throw new Error(`Status Check Error: ${data.error.message}`);
      const status = data.status_code;
      console.log(`[Instagram API] Container ${containerId} status: ${status} (Attempt ${i + 1})`);
      if (status === 'FINISHED') return;
      if (status === 'ERROR') throw new Error("Instagram failed to process this media.");
      if (status === 'EXPIRED') throw new Error("Media container expired.");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error("Timeout waiting for Instagram to process media.");
  };

  try {
    const isCarousel = mediaItems.length > 1;
    let finalCreationId = "";

    if (isCarousel) {
      onProgress("Uploading carousel items...");
      const itemIds: string[] = [];
      for (const [index, item] of mediaItems.entries()) {
        let itemUrl = item.url;
        if (item.type === 'IMAGE' && itemUrl.includes('imagekit.io')) itemUrl += itemUrl.includes('?') ? '&tr=f-jpg' : '?tr=f-jpg';
        const body: any = { is_carousel_item: true };
        if (item.type === 'IMAGE') body.image_url = itemUrl;
        else { body.media_type = 'VIDEO'; body.video_url = itemUrl; }
        console.log(`[Instagram API] Uploading Carousel Item ${index + 1} (${item.type}):`, itemUrl);
        const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await handleResponse(res, `Upload Media ${index + 1}`);
        itemIds.push(data.id);
      }
      onProgress("Waiting for items to process...");
      for (const id of itemIds) await waitForContainer(id);
      onProgress("Creating carousel container...");
      const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "CAROUSEL", caption, children: itemIds.join(',') }) });
      const carouselData = await handleResponse(res, "Create Carousel Container");
      finalCreationId = carouselData.id;
    } else {
      const item = mediaItems[0];
      onProgress(`Uploading single ${item.type.toLowerCase()}...`);
      let itemUrl = item.url;
      if (item.type === 'IMAGE' && itemUrl.includes('imagekit.io')) itemUrl += itemUrl.includes('?') ? '&tr=f-jpg' : '?tr=f-jpg';
      const body: any = { caption };
      if (item.type === 'IMAGE') body.image_url = itemUrl;
      else { body.media_type = 'VIDEO'; body.video_url = itemUrl; }
      console.log(`[Instagram API] Uploading Single ${item.type}:`, itemUrl);
      const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await handleResponse(res, "Upload Single Media");
      finalCreationId = data.id;
    }

    onProgress("Finalizing post...");
    await waitForContainer(finalCreationId);
    onProgress("Publishing to feed...");
    const publishRes = await fetch(`${BASE_URL}/${accountId}/media_publish?access_token=${accessToken}&creation_id=${finalCreationId}`, { method: "POST" });
    const publishData = await handleResponse(publishRes, "Publish Container");
    return publishData.id;
  } catch (error: any) {
    console.error("Publishing Failed:", error);
    throw error;
  }
};
// ============== END INLINED INSTAGRAM SERVICE ==============

interface ScheduledPost {
  id: string;
  scheduledTime: string;
  caption: string;
  mediaItems: MediaItem[];
  sheetRowIndex: number;
  status: string;
}

export default async function handler(req: any, res: any) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const cronSecret = process.env.CRON_SECRET;

  const authHeader = req.headers.authorization;
  const queryKey = req.query.key;

  if (cronSecret && (authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!spreadsheetId) {
    return res.status(500).json({ error: "Missing SPREADSHEET_ID environment variable" });
  }

  try {
    console.log("Fetching remote settings from Sheet...");
    const { profiles } = await fetchServerSettings(spreadsheetId);

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ message: "No profiles found in Profiles tab" });
    }

    const allResults: any[] = [];

    for (const profile of profiles) {
      const { accountId, accessToken, sheetTabName, name } = profile;
      console.log(`--- Processing Profile: ${name} (${accountId}) ---`);

      if (!accountId || !accessToken) {
        console.warn(`Skipping profile ${name}: Missing credentials`);
        allResults.push({ profile: name, status: 'skipped', message: 'Missing credentials' });
        continue;
      }

      try {
        const rows = await fetchServerSheetData(spreadsheetId, sheetTabName);
        const now = new Date();

        const posts: ScheduledPost[] = rows.map((row: any[], index: number) => {
          const dateStr = row[1];
          const status = row[7]?.toLowerCase() || 'pending';
          const urlsStr = row[8] || "";
          const urls = urlsStr ? urlsStr.split(',').map((s: string) => s.trim()) : [];
          if (!dateStr) return null;
          return {
            id: `cron_${profile.id}_${index}`,
            scheduledTime: new Date(dateStr).toISOString(),
            caption: row[4] || "",
            mediaItems: urls.map((url: string, i: number) => ({ id: `cron_${profile.id}_${index}_${i}`, url, type: url.toLowerCase().match(/\.(mp4|mov|avi|wmv|m4v)$/) ? 'VIDEO' : 'IMAGE' })),
            sheetRowIndex: index + 2,
            status: status
          };
        }).filter((p: any) => p !== null) as ScheduledPost[];

        const duePosts = posts.filter(p => p.status !== 'published' && new Date(p.scheduledTime) <= now);

        if (duePosts.length === 0) {
          allResults.push({ profile: name, status: 'success', message: 'No due posts' });
          continue;
        }

        const profileResults: any[] = [];
        for (const post of duePosts) {
          try {
            console.log(`[${name}] Processing post: ${post.sheetRowIndex}`);
            await publishCarouselPost(accountId, accessToken, post.caption, post.mediaItems, (status) => console.log(`[${name}][Row ${post.sheetRowIndex}] ${status}`));
            await updateServerPostStatus(spreadsheetId, sheetTabName, post.sheetRowIndex, 'published');
            profileResults.push({ rowIndex: post.sheetRowIndex, status: 'success' });
          } catch (postError: any) {
            console.error(`[${name}] Failed to publish post at row ${post.sheetRowIndex}:`, postError);
            profileResults.push({ rowIndex: post.sheetRowIndex, status: 'error', message: postError.message });
          }
        }
        allResults.push({ profile: name, status: 'completed', results: profileResults });

      } catch (profileError: any) {
        console.error(`Error processing profile ${name}:`, profileError);
        allResults.push({ profile: name, status: 'error', message: profileError.message });
      }
    }

    return res.status(200).json({ results: allResults });

  } catch (error: any) {
    console.error("Cron job failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
