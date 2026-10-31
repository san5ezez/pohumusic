// ============================================================================
// POHUMUSIC — YOUTUBE DATA API v3 & OFFICIAL EMBED TYPES
// ============================================================================

export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeVideoItem {
  id: string | { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    tags?: string[];
    categoryId?: string;
    defaultAudioLanguage?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
  };
  contentDetails?: {
    duration?: string; // ISO 8601 e.g. PT3M42S
    LicensedContent?: boolean;
    regionRestriction?: {
      allowed?: string[];
      blocked?: string[];
    };
  };
  status?: {
    uploadStatus?: string;
    privacyStatus?: string;
    embeddable?: boolean;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
}

export interface YouTubeChannelItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
  };
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
  contentDetails?: {
    itemCount?: number;
  };
}

export interface YouTubeListResponse<T> {
  kind: string;
  etag?: string;
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: T[];
}

export interface YouTubeQuotaStatus {
  dateKey: string;
  usedUnits: number;
  dailyLimit: number;
  remainingUnits: number;
}
