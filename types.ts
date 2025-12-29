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

export interface InstagramProfile {
  id: string;
  name: string;
  accountId: string;
  accessToken: string;
  sheetTabName: string;
  logsTabName?: string;
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
  spreadsheetId: string;
  profiles: InstagramProfile[];
  activeProfileId?: string;

  settingsTabName?: string; // For the Configuration data (defaults to 'Settings')
  logsTabName?: string; // For Activity Logs (defaults to 'Logs')

  // ImageKit Settings (Global)
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
  profileId?: string;
}

export enum InstagramApiStatus {
  IDLE = 'IDLE',
  UPLOADING_MEDIA = 'UPLOADING_MEDIA',
  CREATING_CAROUSEL = 'CREATING_CAROUSEL',
  PUBLISHING = 'PUBLISHING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'confirm';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}