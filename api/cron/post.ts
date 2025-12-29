import { fetchServerSheetData, updateServerPostStatus, fetchServerSettings } from '../../services/serverSheetService';
import { publishCarouselPost } from '../../services/instagramService';
import { ScheduledPost } from '../../types';

/**
 * Vercel Cron Job handler.
 * This endpoint is called automatically by Vercel.
 */
export default async function handler(req: any, res: any) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const cronSecret = process.env.CRON_SECRET;

  // Security Check
  const authHeader = req.headers.authorization;
  const queryKey = req.query.key;

  if (cronSecret && (authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!spreadsheetId) {
    return res.status(500).json({ error: "Missing SPREADSHEET_ID environment variable" });
  }

  try {
    // 1. Fetch settings from the Sheet first (Global + Profiles)
    console.log("Fetching remote settings from Sheet...");
    const { profiles } = await fetchServerSettings(spreadsheetId);

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ message: "No profiles found in Profiles tab" });
    }

    const allResults = [];

    // 2. Process each profile
    for (const profile of profiles) {
      const { accountId, accessToken, sheetTabName, name } = profile;
      console.log(`--- Processing Profile: ${name} (${accountId}) ---`);

      if (!accountId || !accessToken) {
        console.warn(`Skipping profile ${name}: Missing credentials`);
        allResults.push({ profile: name, status: 'skipped', message: 'Missing credentials' });
        continue;
      }

      try {
        // Fetch scheduled posts for this profile
        const rows = await fetchServerSheetData(spreadsheetId, sheetTabName);
        const now = new Date();

        const posts: ScheduledPost[] = rows.map((row, index) => {
          const dateStr = row[1];
          const status = row[7]?.toLowerCase() || 'pending';
          const urlsStr = row[8] || "";
          const urls = urlsStr ? urlsStr.split(',').map((s: string) => s.trim()) : [];

          if (!dateStr) return null;

          return {
            id: `cron_${profile.id}_${index}`,
            scheduledTime: new Date(dateStr).toISOString(),
            caption: row[4] || "",
            mediaItems: urls.map((url: string, i: number) => ({
              id: `cron_${profile.id}_${index}_${i}`,
              url,
              type: url.toLowerCase().match(/\.(mp4|mov|avi|wmv|m4v)$/) ? 'VIDEO' : 'IMAGE'
            })),
            sheetRowIndex: index + 2,
            status: status as any
          };
        }).filter(p => p !== null) as ScheduledPost[];

        // Find due posts
        const duePosts = posts.filter(p => p.status !== 'published' && new Date(p.scheduledTime) <= now);

        if (duePosts.length === 0) {
          allResults.push({ profile: name, status: 'success', message: 'No due posts' });
          continue;
        }

        const profileResults = [];
        for (const post of duePosts) {
          try {
            console.log(`[${name}] Processing post: ${post.sheetRowIndex}`);

            await publishCarouselPost(
              accountId,
              accessToken,
              post.caption,
              post.mediaItems,
              (status) => console.log(`[${name}][Row ${post.sheetRowIndex}] ${status}`)
            );

            // Update status in sheet
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
