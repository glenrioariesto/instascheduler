import { MediaItem } from "../types";

const BASE_URL = "https://graph.facebook.com/v24.0";

/**
 * Publishes a Carousel Post to Instagram via Graph API.
 * 
 * Flow:
 * 1. Upload each media item to get a container ID (is_carousel_item=true).
 * 2. Create a carousel container using the IDs from step 1.
 * 3. Publish the carousel container.
 */
export const publishCarouselPost = async (
  accountId: string,
  accessToken: string,
  caption: string,
  mediaItems: MediaItem[],
  onProgress: (status: string) => void
): Promise<string> => {
  if (!accountId || !accessToken) {
    throw new Error("Missing Account ID or Access Token");
  }

  if (mediaItems.length === 0) {
    throw new Error("No media items provided");
  }

  if (mediaItems.length > 10) {
    throw new Error("Instagram carousels support a maximum of 10 items");
  }

  const handleResponse = async (res: Response, stage: string) => {
    const data = await res.json();
    if (data.error) {
      console.error(`Instagram API Error [${stage}]:`, data);
      throw new Error(`Instagram API Error [${stage}]: ${data.error.message}${data.error.error_user_msg ? ' - ' + data.error.error_user_msg : ''}`);
    }
    return data;
  };

  /**
   * Polls the status of a media container until it's ready or fails.
   */
  const waitForContainer = async (containerId: string, maxRetries = 20): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(`${BASE_URL}/${containerId}?fields=status_code&access_token=${accessToken}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(`Status Check Error: ${data.error.message}`);
      }

      const status = data.status_code;
      console.log(`[Instagram API] Container ${containerId} status: ${status} (Attempt ${i + 1})`);

      if (status === 'FINISHED') return;
      if (status === 'ERROR') throw new Error("Instagram failed to process this media.");
      if (status === 'EXPIRED') throw new Error("Media container expired.");

      // Wait 3 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error("Timeout waiting for Instagram to process media.");
  };

  try {
    const isCarousel = mediaItems.length > 1;
    let finalCreationId = "";

    if (isCarousel) {
      // --- MULTI-ITEM FLOW (CAROUSEL) ---
      onProgress("Uploading carousel items...");
      const itemIds: string[] = [];

      for (const [index, item] of mediaItems.entries()) {
        let itemUrl = item.url;
        if (item.type === 'IMAGE' && itemUrl.includes('imagekit.io')) {
          itemUrl += itemUrl.includes('?') ? '&tr=f-jpg' : '?tr=f-jpg';
        }

        const body: any = {
          is_carousel_item: true,
        };

        if (item.type === 'IMAGE') {
          body.image_url = itemUrl;
        } else {
          body.media_type = 'VIDEO';
          body.video_url = itemUrl;
        }

        console.log(`[Instagram API] Uploading Carousel Item ${index + 1} (${item.type}):`, itemUrl);

        const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await handleResponse(res, `Upload Media ${index + 1}`);
        itemIds.push(data.id);
      }

      // Wait for all children to be ready
      onProgress("Waiting for items to process...");
      for (const id of itemIds) {
        await waitForContainer(id);
      }

      onProgress("Creating carousel container...");
      const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          caption: caption,
          children: itemIds.join(','),
        }),
      });

      const carouselData = await handleResponse(res, "Create Carousel Container");
      finalCreationId = carouselData.id;
    } else {
      // --- SINGLE-ITEM FLOW ---
      const item = mediaItems[0];
      onProgress(`Uploading single ${item.type.toLowerCase()}...`);

      let itemUrl = item.url;
      if (item.type === 'IMAGE' && itemUrl.includes('imagekit.io')) {
        itemUrl += itemUrl.includes('?') ? '&tr=f-jpg' : '?tr=f-jpg';
      }

      const body: any = {
        caption: caption,
      };

      if (item.type === 'IMAGE') {
        body.image_url = itemUrl;
        // Note: media_type is NOT required for single images
      } else {
        body.media_type = 'VIDEO';
        body.video_url = itemUrl;
      }

      console.log(`[Instagram API] Uploading Single ${item.type}:`, itemUrl);

      const res = await fetch(`${BASE_URL}/${accountId}/media?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await handleResponse(res, "Upload Single Media");
      finalCreationId = data.id;
    }

    // --- Step 3: Wait for Final Container & Publish ---
    onProgress("Finalizing post...");
    await waitForContainer(finalCreationId);

    onProgress("Publishing to feed...");
    const publishRes = await fetch(`${BASE_URL}/${accountId}/media_publish?access_token=${accessToken}&creation_id=${finalCreationId}`, {
      method: "POST",
    });

    const publishData = await handleResponse(publishRes, "Publish Container");
    return publishData.id;

  } catch (error: any) {
    console.error("Publishing Failed:", error);
    throw error;
  }
};



/**
 * Fetches the Instagram Business Account ID associated with the user's Facebook Pages.
 * Returns the first valid ID found.
 */
export const getInstagramBusinessId = async (accessToken: string): Promise<string> => {
  if (!accessToken) throw new Error("Access Token is required");

  // 1. Get User's Pages
  const pagesRes = await fetch(`${BASE_URL}/me/accounts?fields=instagram_business_account,name&access_token=${accessToken}`);
  const pagesData = await pagesRes.json();

  if (pagesData.error) {
    throw new Error(`Failed to fetch pages: ${pagesData.error.message}`);
  }

  // 2. Find first page with connected Instagram account
  for (const page of pagesData.data) {
    if (page.instagram_business_account && page.instagram_business_account.id) {
      return page.instagram_business_account.id;
    }
  }

  throw new Error("No Instagram Business Account found linked to your Facebook Pages.");
};