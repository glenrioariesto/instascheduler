import { AppSettings, PostData } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  spreadsheetId: '',
  profiles: [],
  activeProfileId: '',
  imageKitPublicKey: '',
  imageKitPrivateKey: '',
  imageKitUrlEndpoint: '',
};

export const INITIAL_POST: PostData = {
  id: 'new',
  caption: '',
  media_items: [
    { id: '1', type: 'IMAGE', url: '' },
    { id: '2', type: 'IMAGE', url: '' }
  ],
  status: 'draft',
  lastUpdated: Date.now(),
};

export const STORAGE_KEYS = {
  SETTINGS: 'instascheduler_settings',
  LOGS: 'instascheduler_logs',
  DRAFTS: 'instascheduler_drafts',
  PUBLISHED_IDS: 'instascheduler_published_ids' // To track what we've already posted from the sheet
};