import type {
  PlatformConnection,
  PlatformId,
  PlatformSyncResult,
  Profile,
  SyncRunReport,
} from "@vexa/shared";
import { PLATFORM_SYNC_MAX_AGE_HOURS } from "@vexa/shared";

/**
 * Demo / offline sync adapters.
 * Production: replace with OAuth-token API calls (LinkedIn OpenID, X API v2,
 * GitHub Apps, Google People, etc.). Never scrape authenticated sessions.
 */

type SyncPayload = {
  fields: string[];
  profilePatch: Partial<Profile>;
  skillsToMerge?: string[];
  interestsToMerge?: string[];
};

function mockSyncForPlatform(
  platformId: PlatformId,
  handle: string | undefined,
  profile: Profile
): SyncPayload {
  switch (platformId) {
    case "linkedin":
      return {
        fields: ["headline", "summary", "experiences", "skills", "linkedinUrl"],
        profilePatch: {
          headline: profile.headline ?? "Senior Frontend Engineer",
          summary:
            profile.summary ||
            "Product-minded frontend engineer. Synced from LinkedIn profile.",
          linkedinUrl:
            profile.linkedinUrl ||
            `https://linkedin.com/in/${handle ?? "alexrivera"}`,
        },
        skillsToMerge: ["Stakeholder Communication", "Cross-functional Leadership"],
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
            profile.githubUrl || `https://github.com/${handle ?? "alexrivera"}`,
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

export function applyPlatformSync(
  profile: Profile,
  connection: PlatformConnection
): { profile: Profile; result: PlatformSyncResult } {
  const now = new Date().toISOString();
  try {
    const payload = mockSyncForPlatform(
      connection.platformId,
      connection.externalHandle,
      profile
    );

    let next: Profile = {
      ...profile,
      ...payload.profilePatch,
      skills: [...profile.skills],
      interests: [...profile.interests],
      preferredLocations: [
        ...(payload.profilePatch.preferredLocations ??
          profile.preferredLocations),
      ],
      preferredIndustries: [
        ...(payload.profilePatch.preferredIndustries ??
          profile.preferredIndustries),
      ],
    };

    if (payload.skillsToMerge?.length) {
      const existing = new Set(next.skills.map((s) => s.name.toLowerCase()));
      for (const name of payload.skillsToMerge) {
        if (!existing.has(name.toLowerCase())) {
          next.skills.push({
            id: `sync_${connection.platformId}_${name
              .toLowerCase()
              .replace(/\s+/g, "_")}`,
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
