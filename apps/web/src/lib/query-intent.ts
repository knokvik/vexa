/**
 * User intent → keyword combinations for job discovery.
 * Expands short signals (intern, quant, SWE) into search-ready queries.
 */

export type IntentExpansion = {
  /** Primary query to run first */
  primary: string;
  /** Extra queries (run as variants or merged into one rich query) */
  variants: string[];
  /** Normalized role family */
  family: string;
  /** Detected seniority / type tags */
  tags: string[];
};

const ROLE_ALIASES: Record<string, string[]> = {
  swe: ["software engineer", "software developer", "backend engineer", "full stack engineer"],
  "software engineer": [
    "software engineer",
    "software developer",
    "SWE",
    "full stack engineer",
  ],
  "software": ["software engineer", "software developer"],
  backend: ["backend engineer", "backend developer", "server engineer"],
  frontend: ["frontend engineer", "front-end engineer", "React engineer"],
  fullstack: ["full stack engineer", "fullstack engineer", "full-stack developer"],
  "full stack": ["full stack engineer", "fullstack developer"],
  ml: ["machine learning engineer", "ML engineer", "applied scientist"],
  "machine learning": ["machine learning engineer", "ML engineer"],
  quant: [
    "quantitative developer",
    "quant developer",
    "quantitative researcher",
    "quantitative trader",
  ],
  quantitative: ["quantitative developer", "quant researcher"],
  data: ["data engineer", "data scientist", "analytics engineer"],
  "data engineer": ["data engineer", "analytics engineer"],
  devops: ["DevOps engineer", "SRE", "platform engineer", "infrastructure engineer"],
  sre: ["site reliability engineer", "SRE", "platform engineer"],
  product: ["product manager", "technical product manager"],
  pm: ["product manager", "program manager"],
  intern: ["intern", "internship", "new grad", "university graduate"],
  internship: ["intern", "internship", "co-op"],
  "new grad": ["new grad", "university graduate", "entry level"],
  infra: ["infrastructure engineer", "platform engineer", "systems engineer"],
  security: ["security engineer", "application security", "AppSec"],
  mobile: ["iOS engineer", "Android engineer", "mobile engineer"],
  ios: ["iOS engineer", "Swift engineer"],
  android: ["Android engineer", "Kotlin engineer"],
};

const SENIORITY = [
  "intern",
  "internship",
  "junior",
  "entry",
  "new grad",
  "mid",
  "senior",
  "staff",
  "principal",
  "lead",
  "director",
];

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9+#./]+/i)
    .filter((t) => t.length > 1);
}

/**
 * Expand a free-text intent into stronger discovery queries.
 */
export function expandSearchIntent(raw: string): IntentExpansion {
  const input = (raw || "").trim();
  if (!input) {
    return {
      primary: "software engineer",
      variants: ["software engineer remote", "backend engineer"],
      family: "software",
      tags: [],
    };
  }

  const lower = input.toLowerCase();
  const tokens = tokenize(input);
  const tags: string[] = [];
  const expansions = new Set<string>();

  // Detect seniority / intern
  for (const s of SENIORITY) {
    if (lower.includes(s)) tags.push(s);
  }

  // Alias expansion
  let family = "general";
  for (const [key, alts] of Object.entries(ROLE_ALIASES)) {
    if (lower.includes(key) || tokens.includes(key.replace(/\s+/g, ""))) {
      family = key;
      for (const a of alts) expansions.add(a);
    }
  }

  // If nothing matched, keep original as primary
  if (expansions.size === 0) {
    expansions.add(input);
  }

  // Combine seniority + role
  const isIntern = tags.some((t) => /intern|new grad|entry|junior/i.test(t));
  const isSenior = tags.some((t) => /senior|staff|principal|lead/i.test(t));

  const variants: string[] = [];
  for (const role of [...expansions].slice(0, 4)) {
    if (isIntern) {
      variants.push(`${role} intern`);
      variants.push(`${role} internship`);
      variants.push(`new grad ${role}`);
    } else if (isSenior) {
      variants.push(`senior ${role}`);
      variants.push(`staff ${role}`);
    } else {
      variants.push(role);
      variants.push(`${role} remote`);
    }
  }

  // Deduplicate preserve order
  const seen = new Set<string>();
  const uniq = [input, ...variants].filter((v) => {
    const k = v.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return k.length > 2;
  });

  return {
    primary: uniq[0],
    variants: uniq.slice(1, 6),
    family,
    tags,
  };
}

/**
 * Single rich query string for Firecrawl/Exa (OR of top variants).
 * Providers handle natural language better than giant OR in some cases —
 * we return primary + optional boost phrase.
 */
export function buildDiscoveryQuery(raw: string): {
  query: string;
  expansion: IntentExpansion;
} {
  const expansion = expandSearchIntent(raw);
  // Prefer the richest role phrase for search backends
  const best =
    expansion.variants.find((v) =>
      /engineer|developer|intern|quant|manager/i.test(v)
    ) || expansion.primary;

  // Keep user words that aren't covered (location, company, stack)
  const extra = tokenize(raw).filter(
    (t) =>
      !best.toLowerCase().includes(t) &&
      !["job", "jobs", "role", "roles", "position", "hiring"].includes(t)
  );

  const query =
    extra.length > 0 ? `${best} ${extra.slice(0, 4).join(" ")}`.trim() : best;

  return { query, expansion };
}
