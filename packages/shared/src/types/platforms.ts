/** External identity / data sources the user can connect. */
export type PlatformId =
  | "linkedin"
  | "x"
  | "github"
  | "google"
  | "indeed"
  | "wellfound";

export type PlatformConnectionStatus =
  | "disconnected"
  | "connected"
  | "syncing"
  | "error"
  | "expired";

export type PlatformSyncScope =
  | "profile"
  | "experience"
  | "skills"
  | "posts"
  | "job_alerts"
  | "portfolio";

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  description: string;
  /** What we pull when daily sync runs. */
  syncScopes: PlatformSyncScope[];
  /** OAuth needs real app credentials in production. */
  oauthReady: boolean;
  brandColor: string;
  icon: string;
}

export interface PlatformConnection {
  platformId: PlatformId;
  status: PlatformConnectionStatus;
  /** When true, included in daily pre-apply sync. */
  syncEnabled: boolean;
  connectedAt?: string;
  lastSyncedAt?: string;
  nextSyncAt?: string;
  externalHandle?: string;
  externalProfileUrl?: string;
  errorMessage?: string;
  /** Fields last updated from this platform. */
  lastSyncSummary?: string[];
}

export interface PlatformSyncResult {
  platformId: PlatformId;
  ok: boolean;
  syncedAt: string;
  fieldsUpdated: string[];
  error?: string;
}

export interface SyncRunReport {
  ranAt: string;
  triggeredBy: "daily" | "manual" | "pre_apply" | "pre_automation";
  skipped: boolean;
  skipReason?: string;
  results: PlatformSyncResult[];
  profileTouched: boolean;
}

/** Hours before a connected platform is considered stale. */
export const PLATFORM_SYNC_MAX_AGE_HOURS = 24;
