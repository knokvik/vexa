/**
 * Job data cleaning agent (heuristic — fast, no LLM required).
 * Fixes portal-as-company bugs (Ashbyhq, ZipRecruiter, Greenhouse board tokens)
 * and pulls real employer names from URL / title patterns.
 */

/** Hosts / tokens that are ATS portals or aggregators — never "companies" */
export const PORTAL_BRANDS = new Set(
  [
    "ashbyhq",
    "ashby",
    "greenhouse",
    "lever",
    "workday",
    "myworkdayjobs",
    "smartrecruiters",
    "jobvite",
    "icims",
    "taleo",
    "bamboohr",
    "successfactors",
    "ziprecruiter",
    "indeed",
    "glassdoor",
    "linkedin",
    "wellfound",
    "angel",
    "dice",
    "monster",
    "simplyhired",
    "jobera",
    "jobsradar",
    "jobs-radar",
    "jobgether",
    "builtin",
    "levels",
    "levels.fyi",
    "otta",
    "hired",
    "triplebyte",
    "careers",
    "jobs",
    "boards",
    "job-boards",
    "applytojob",
    "recruitee",
    "personio",
    "teamtailor",
    "workable",
    "breezy",
    "exacom",
  ].map((s) => s.toLowerCase())
);

function titleCaseToken(s: string): string {
  if (!s) return s;
  // Keep short ALLCAPS (IBM, AWS)
  if (s.length <= 4 && s === s.toUpperCase()) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(titleCaseToken)
    .join(" ");
}

function isPortalName(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return true;
  if (PORTAL_BRANDS.has(n)) return true;
  for (const p of PORTAL_BRANDS) {
    if (n.includes(p) && n.length < p.length + 4) return true;
  }
  return false;
}

/**
 * Extract employer from job URL (Greenhouse / Lever / Ashby / LinkedIn / company careers).
 */
export function companyFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname;

    // boards.greenhouse.io/{token}/jobs/{id}
    // job-boards.greenhouse.io/{token}/jobs/{id}
    let m = path.match(
      /(?:boards(?:-api)?\.greenhouse\.io|job-boards\.greenhouse\.io)\/([^/]+)/i
    );
    if (!m) m = url.match(/greenhouse\.io\/([^/?#]+)/i);
    if (m?.[1] && !["v1", "embed", "jobs"].includes(m[1].toLowerCase())) {
      return humanizeSlug(m[1]);
    }

    // jobs.lever.co/{slug}/{id}
    m = url.match(/(?:jobs\.)?lever\.co\/([^/?#]+)/i);
    if (m?.[1] && m[1].toLowerCase() !== "v0") {
      return humanizeSlug(m[1]);
    }

    // jobs.ashbyhq.com/{company}/{jobId}
    m = url.match(/ashbyhq\.com\/([^/?#]+)/i);
    if (m?.[1] && !["api", "jobs"].includes(m[1].toLowerCase())) {
      const slug = m[1];
      if (!isPortalName(slug)) return humanizeSlug(slug);
    }

    // LinkedIn: .../jobs/view/role-at-company-12345
    m = path.match(/\/jobs\/view\/([^/?#]+)/i);
    if (m?.[1]) {
      const slug = m[1];
      const at = slug.match(/-at-([a-z0-9][a-z0-9-]{1,40}?)(?:-\d+)?$/i);
      if (at?.[1] && !isPortalName(at[1])) {
        return humanizeSlug(at[1]);
      }
    }

    // company.myworkdayjobs.com or workday
    m = host.match(/^([a-z0-9-]+)\.myworkdayjobs\.com$/i);
    if (m?.[1] && !isPortalName(m[1])) return humanizeSlug(m[1]);

    // careers.company.com / jobs.company.com
    m = host.match(/^(?:careers|jobs)\.([a-z0-9-]+)\./i);
    if (m?.[1] && !isPortalName(m[1])) return humanizeSlug(m[1]);

    // company.com/careers/...
    const parts = host.split(".");
    if (parts.length >= 2) {
      const brand = parts[parts.length - 2];
      if (brand && !isPortalName(brand) && brand.length > 2) {
        // Only trust if path looks like a job
        if (/\/(jobs?|careers|positions|openings)\//i.test(path)) {
          return humanizeSlug(brand);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Extract company + clean title from messy titles.
 * "Exa hiring Product Marketing in San Francisco" → { company: Exa, title: Product Marketing }
 */
export function parseTitleCompany(title?: string): {
  company: string | null;
  title: string | null;
} {
  if (!title) return { company: null, title: null };
  let t = title.trim();

  // "Company hiring Role"
  let m = t.match(
    /^([A-Z][A-Za-z0-9.&'’\-\s]{1,40}?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i
  );
  if (m) {
    const co = m[1].trim();
    if (!isPortalName(co)) {
      return {
        company: co,
        title: m[2].replace(/\s+in\s+[A-Z].*$/i, "").trim(),
      };
    }
  }

  // "Role at Company"
  m = t.match(/^(.+?)\s+at\s+([A-Z][A-Za-z0-9.&'’\-\s]{1,40})$/i);
  if (m && !isPortalName(m[2])) {
    return { company: m[2].trim(), title: m[1].trim() };
  }

  // "Company — Role" / "Company | Role" / "Company - Role"
  m = t.match(/^([A-Z][A-Za-z0-9.&'’\s]{1,30})\s*[|–—\-]\s*(.+)$/);
  if (m && !isPortalName(m[1]) && m[2].length > 3) {
    return { company: m[1].trim(), title: m[2].trim() };
  }

  // Strip trailing location noise from title
  t = t
    .replace(/\s+in\s+[A-Z][A-Za-z\s,]+$/i, "")
    .replace(/\s*\([^)]*Remote[^)]*\)\s*$/i, "")
    .trim();

  return { company: null, title: t.slice(0, 120) };
}

export function cleanJobTitle(title: string | undefined, fallback = "Role"): string {
  const parsed = parseTitleCompany(title);
  if (parsed.title) return parsed.title.slice(0, 120);
  if (!title) return fallback;
  return title
    .replace(/\s*[|\-–—].{10,}$/, "")
    .replace(/\s+hiring\s+/i, " ")
    .trim()
    .slice(0, 120) || fallback;
}

/**
 * Resolve best company name for a listing.
 */
export function resolveCompany(opts: {
  company?: string;
  title?: string;
  url?: string;
}): string {
  const fromUrl = companyFromUrl(opts.url);
  if (fromUrl && !isPortalName(fromUrl)) return fromUrl;

  const fromTitle = parseTitleCompany(opts.title);
  if (fromTitle.company && !isPortalName(fromTitle.company)) {
    return fromTitle.company;
  }

  const raw = (opts.company || "").replace(/\s+hiring.*$/i, "").trim();
  if (raw && !isPortalName(raw) && !/^[a-z0-9-]+$/i.test(raw) === false) {
    // Prefer humanized if looks like a slug
    if (/^[a-z0-9_-]+$/i.test(raw) && raw.length > 2) {
      const h = humanizeSlug(raw);
      if (!isPortalName(h)) return h;
    }
    if (!isPortalName(raw)) return raw.slice(0, 48);
  }

  if (fromUrl) return fromUrl; // last resort even if portal-ish
  return raw && !isPortalName(raw) ? raw : "Unknown company";
}

export type NormalizedJobPatch = {
  company: string;
  title: string;
  isPortalListing: boolean;
};

/** Full clean pass for one job row */
export function normalizeJobFields(job: {
  company?: string;
  title?: string;
  externalUrl?: string;
}): NormalizedJobPatch {
  const company = resolveCompany({
    company: job.company,
    title: job.title,
    url: job.externalUrl,
  });
  const title = cleanJobTitle(job.title, "Role");
  const isPortalListing =
    isPortalName(job.company || "") ||
    /ashbyhq|ziprecruiter|indeed\.com|linkedin\.com\/jobs\/search/i.test(
      job.externalUrl || ""
    );

  return {
    company,
    title,
    isPortalListing,
  };
}

/** True if this label should never appear in "Top companies" */
export function isUsableCompanyLabel(name: string): boolean {
  if (!name || name === "Unknown company" || name === "Company") return false;
  if (isPortalName(name)) return false;
  // Titles mistaken as companies
  if (
    /\b(engineer|developer|manager|director|intern|analyst|specialist)\b/i.test(
      name
    ) &&
    name.split(/\s+/).length > 3
  ) {
    return false;
  }
  return true;
}
