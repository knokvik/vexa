import type { PlatformId, Profile } from "@vexa/shared";
import type { OAuthProviderId } from "./config";

export type RealSyncPayload = {
  fields: string[];
  profilePatch: Partial<Profile>;
  skillsToMerge?: string[];
  interestsToMerge?: string[];
  handle?: string;
  profileUrl?: string;
};

async function githubProfile(accessToken: string): Promise<RealSyncPayload> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Vexa-OAuth",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const u = (await res.json()) as {
    login: string;
    name?: string;
    bio?: string;
    blog?: string;
    html_url: string;
    location?: string;
    company?: string;
  };

  // Languages from top repos (best-effort)
  const reposRes = await fetch(
    "https://api.github.com/user/repos?per_page=20&sort=updated",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Vexa-OAuth",
      },
    }
  );
  const skills = new Set<string>();
  if (reposRes.ok) {
    const repos = (await reposRes.json()) as Array<{ language?: string | null }>;
    for (const r of repos) {
      if (r.language) skills.add(r.language);
    }
  }

  return {
    fields: ["githubUrl", "summary", "location", "skills", "fullName"],
    handle: u.login,
    profileUrl: u.html_url,
    profilePatch: {
      fullName: u.name || undefined,
      summary: u.bio || undefined,
      location: u.location || undefined,
      githubUrl: u.html_url,
      portfolioUrl: u.blog || undefined,
    },
    skillsToMerge: [...skills],
  };
}

async function googleProfile(accessToken: string): Promise<RealSyncPayload> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo ${res.status}`);
  const u = (await res.json()) as {
    name?: string;
    email?: string;
    picture?: string;
    email_verified?: boolean;
  };
  return {
    fields: ["fullName", "email verified"],
    handle: u.email,
    profilePatch: {
      fullName: u.name || undefined,
    },
  };
}

async function linkedinProfile(accessToken: string): Promise<RealSyncPayload> {
  // OpenID userinfo — works with openid profile email scopes
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LinkedIn userinfo ${res.status}: ${t.slice(0, 120)}`);
  }
  const u = (await res.json()) as {
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    picture?: string;
    locale?: { country?: string };
  };
  const fullName =
    u.name ||
    [u.given_name, u.family_name].filter(Boolean).join(" ") ||
    undefined;

  return {
    fields: ["fullName", "linkedin identity"],
    handle: u.email,
    profileUrl: undefined, // vanity URL needs r_basicprofile (restricted)
    profilePatch: {
      fullName,
      // User can still set public LinkedIn URL manually
    },
  };
}

async function xProfile(accessToken: string): Promise<RealSyncPayload> {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=description,location,url,username,name",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`X API ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    data?: {
      username: string;
      name?: string;
      description?: string;
      location?: string;
      url?: string;
    };
  };
  const u = data.data;
  if (!u) throw new Error("X user payload empty");

  const interests =
    u.description
      ?.split(/[,#|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 40)
      .slice(0, 8) ?? [];

  return {
    fields: ["fullName", "summary", "location", "interests"],
    handle: u.username,
    profileUrl: `https://x.com/${u.username}`,
    profilePatch: {
      fullName: u.name || undefined,
      summary: u.description || undefined,
      location: u.location || undefined,
    },
    interestsToMerge: interests,
  };
}

export async function fetchRealPlatformProfile(
  platformId: PlatformId,
  accessToken: string
): Promise<RealSyncPayload> {
  switch (platformId as OAuthProviderId) {
    case "github":
      return githubProfile(accessToken);
    case "google":
      return googleProfile(accessToken);
    case "linkedin":
      return linkedinProfile(accessToken);
    case "x":
      return xProfile(accessToken);
    default:
      throw new Error(`No real profile fetcher for ${platformId}`);
  }
}
