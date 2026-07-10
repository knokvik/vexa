import type {
  PlatformConnection,
  PlatformId,
  PlatformSyncResult,
  Profile,
  SyncRunReport,
} from "@vexa/shared";
import { PLATFORM_SYNC_MAX_AGE_HOURS } from "@vexa/shared";
import { DEMO_USER_ID } from "./demo-data";
import { isOAuthProvider, type OAuthProviderId } from "./oauth/config";
import { refreshAccessToken } from "./oauth/exchange";
import { fetchRealPlatformProfile } from "./oauth/fetch-profile";
import { getTokens, saveTokens } from "./oauth/token-store";

/**
 * Sync adapters: use real OAuth tokens when present; otherwise mock (dev only).
 */

type SyncPayload = {
  fields: string[];
  profilePatch: Partial<Profile>;
  skillsToMerge?: string[];
  interestsToMerge?: string[];
  handle?: string;
  profileUrl?: string;
};

function mockSyncForPlatform(
  platformId: PlatformId,
  handle: string | undefined,
  profile: Profile
): SyncPayload {
  switch (platformId) {
    case "linkedin":
      return {
        fields: ["headline", "summary", "linkedinUrl"],
        profilePatch: {
          headline: profile.headline ?? "Senior Frontend Engineer",
          summary:
            profile.summary ||
            "Product-minded frontend engineer. Synced from LinkedIn profile.",
          linkedinUrl:
            profile.linkedinUrl ||
            `https://linkedin.com/in/${handle ?? "alexrivera"}`,
        },
        skillsToMerge: [
          "Stakeholder Communication",
          "Cross-functional Leadership",
        ],
      };
    case "x":
      return {
        fields: ["interests", "summary tone"],
        profilePatch: {},
        interestsToMerge: ["design systems", "AI tooling", "open source"],
      };
    case "github":
      return {
        fields: ["skills", "githubUrl", "portfolio projects"],
        profilePatch: {
          githubUrl:
            profile.githubUrl ||
            `https://github.com/${handle ?? "alexrivera"}`,
        },
        skillsToMerge: ["TypeScript", "React", "Node.js", "CI/CD"],
      };
    case "google":
      return {
        fields: ["email verified"],
        profilePatch: {},
      };
    case "indeed":
      return {
        fields: ["job alert preferences"],
        profilePatch: {
          preferredLocations: unique([
            ...profile.preferredLocations,
            "remote",
          ]),
        },
      };
    case "wellfound":
      return {
        fields: ["startup interests", "preferred industries"],
        profilePatch: {
          preferredIndustries: unique([
            ...profile.preferredIndustries,
            "SaaS",
            "Developer Tools",
          ]),
        },
      };
    default:
      return { fields: [], profilePatch: {} };
  }
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export function isStale(
  connection: PlatformConnection,
  maxAgeHours = PLATFORM_SYNC_MAX_AGE_HOURS
): boolean {
  if (connection.status !== "connected" && connection.status !== "error") {
    return false;
  }
  if (!connection.syncEnabled) return false;
  if (!connection.lastSyncedAt) return true;
  const ageMs = Date.now() - new Date(connection.lastSyncedAt).getTime();
  return ageMs > maxAgeHours * 60 * 60 * 1000;
}

function mergePayload(profile: Profile, payload: SyncPayload): Profile {
  let next: Profile = {
    ...profile,
    ...payload.profilePatch,
    skills: [...profile.skills],
    interests: [...profile.interests],
    preferredLocations: [
      ...(payload.profilePatch.preferredLocations ?? profile.preferredLocations),
    ],
    preferredIndustries: [
      ...(payload.profilePatch.preferredIndustries ??
        profile.preferredIndustries),
    ],
  };

  // Only overwrite fullName if real value present
  if (payload.profilePatch.fullName) {
    next.fullName = payload.profilePatch.fullName;
  }

  if (payload.skillsToMerge?.length) {
    const existing = new Set(next.skills.map((s) => s.name.toLowerCase()));
    for (const name of payload.skillsToMerge) {
      if (!existing.has(name.toLowerCase())) {
        next.skills.push({
          id: `sync_${name.toLowerCase().replace(/\s+/g, "_")}`,
          name,
          proficiency: "intermediate",
          category: "technical",
        });
        existing.add(name.toLowerCase());
      }
    }
  }

  if (payload.interestsToMerge?.length) {
    next.interests = unique([...next.interests, ...payload.interestsToMerge]);
  }

  return next;
}

async function resolveAccessToken(
  platformId: PlatformId
): Promise<string | null> {
  if (!isOAuthProvider(platformId)) return null;
  const stored = getTokens(DEMO_USER_ID, platformId);
  if (!stored) return null;

  const expired =
    stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now() + 60_000;

  if (expired && stored.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(
        platformId as OAuthProviderId,
        stored.refreshToken
      );
      const expiresAt = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : undefined;
      saveTokens(DEMO_USER_ID, {
        ...stored,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? stored.refreshToken,
        expiresAt,
        obtainedAt: new Date().toISOString(),
      });
      return refreshed.access_token;
    } catch {
      return stored.accessToken;
    }
  }

  return stored.accessToken;
}

/**
 * Async sync: prefers live APIs when OAuth tokens exist.
 */
export async function applyPlatformSync(
  profile: Profile,
  connection: PlatformConnection
): Promise<{ profile: Profile; result: PlatformSyncResult }> {
  const now = new Date().toISOString();
  try {
    const accessToken = await resolveAccessToken(connection.platformId);
    let payload: SyncPayload;

    if (accessToken && isOAuthProvider(connection.platformId)) {
      const real = await fetchRealPlatformProfile(
        connection.platformId,
        accessToken
      );
      payload = real;
    } else if (connection.authMode === "oauth") {
      // Was OAuth-connected but tokens missing
      throw new Error("OAuth tokens missing — reconnect the platform");
    } else {
      // Demo / legacy connect without tokens
      payload = mockSyncForPlatform(
        connection.platformId,
        connection.externalHandle,
        profile
      );
    }

    const next = mergePayload(profile, payload);

    return {
      profile: next,
      result: {
        platformId: connection.platformId,
        ok: true,
        syncedAt: now,
        fieldsUpdated: payload.fields,
      },
    };
  } catch (e) {
    return {
      profile,
      result: {
        platformId: connection.platformId,
        ok: false,
        syncedAt: now,
        fieldsUpdated: [],
        error: e instanceof Error ? e.message : "Sync failed",
      },
    };
  }
}

export function buildSyncReport(
  results: PlatformSyncResult[],
  triggeredBy: SyncRunReport["triggeredBy"],
  skipped: boolean,
  skipReason?: string
): SyncRunReport {
  return {
    ranAt: new Date().toISOString(),
    triggeredBy,
    skipped,
    skipReason,
    results,
    profileTouched: results.some((r) => r.ok && r.fieldsUpdated.length > 0),
  };
}

