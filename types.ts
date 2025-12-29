export interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  alt_text?: string;
}

export interface PostData {
  id: string;
  caption: string;
  media_items: MediaItem[];
  status: 'draft' | 'publishing' | 'published' | 'failed';
  lastUpdated: number;
}

export interface ScheduledPost {
  id: string;
  scheduledTime: string; // ISO String or parsable date string
  caption: string;
  mediaItems: MediaItem[];
  sheetRowIndex: number; // To help identify position
  status: 'pending' | 'due' | 'published' | 'failed' | 'processing';
}

export interface AppSettings {
  accountId: string;
  accessToken: string;
  spreadsheetId: string;
  sheetTabName?: string; // For the Schedule data
  settingsTabName?: string; // For the Configuration data (defaults to 'Settings')
  logsTabName?: string; // For Activity Logs (defaults to 'Logs')
  googleClientId?: string;
  googleAccessToken?: string;
  googleTokenExpiresAt?: number;
  // ImageKit Settings
  imageKitPublicKey?: string;
  imageKitPrivateKey?: string;
  imageKitUrlEndpoint?: string;
  // Remote settings (fetched from Sheet)
  isRemoteConfigured?: boolean;
}

export interface RemoteSettings {
  accountId: string;
  accessToken: string;
  sheetTabName?: string;
  logsTabName?: string;
  imageKitPublicKey?: string;
  imageKitPrivateKey?: string;
  imageKitUrlEndpoint?: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'error';
  message: string;
  details?: string;
}

export enum InstagramApiStatus {
  IDLE = 'IDLE',
  UPLOADING_MEDIA = 'UPLOADING_MEDIA',
  CREATING_CAROUSEL = 'CREATING_CAROUSEL',
  PUBLISHING = 'PUBLISHING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}