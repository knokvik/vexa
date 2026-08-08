/**
 * Entity extraction from job-search emails (company, job, contact, dates, salary).
 */

export type ExtractedEntities = {
  companyName?: string;
  jobTitle?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  domain?: string;
  dates: string[];
  salaryHint?: string;
  calendarLinks: string[];
  sentiment: "positive" | "neutral" | "negative";
};

const DOMAIN_COMPANY: Record<string, string> = {
  stripe: "Stripe",
  google: "Google",
  meta: "Meta",
  facebook: "Meta",
  amazon: "Amazon",
  apple: "Apple",
  netflix: "Netflix",
  microsoft: "Microsoft",
  openai: "OpenAI",
  anthropic: "Anthropic",
  airbnb: "Airbnb",
  uber: "Uber",
  lyft: "Lyft",
  shopify: "Shopify",
  square: "Block",
  block: "Block",
  coinbase: "Coinbase",
  datadog: "Datadog",
  snowflake: "Snowflake",
  cloudflare: "Cloudflare",
  notion: "Notion",
  linear: "Linear",
  figma: "Figma",
  vercel: "Vercel",
  github: "GitHub",
};

const NOISE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "linkedin.com",
  "indeed.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "jobvite.com",
  "taleo.net",
]);

function domainFromEmail(email?: string): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  return email.split("@")[1]?.toLowerCase().trim();
}

function companyFromDomain(domain?: string): string | undefined {
  if (!domain || NOISE_DOMAINS.has(domain)) return undefined;
  const root = domain.split(".")[0];
  if (DOMAIN_COMPANY[root]) return DOMAIN_COMPANY[root];
  // skip mail/hr subdomains
  const parts = domain.replace(/^mail\./, "").replace(/^hr\./, "").split(".");
  const brand = parts[0];
  if (!brand || brand.length < 2) return undefined;
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function cleanTitle(t: string): string {
  return t
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[.!?].*$/, "") // drop trailing sentence
    .replace(/\s+at\s+[A-Z].*$/i, "") // drop "at Company"
    .trim()
    .slice(0, 80);
}

function extractJobTitle(subject: string, body: string): string | undefined {
  const patterns = [
    /(?:thanks for applying|application)[^.\n]{0,40}?(?:for|—|-)\s*([A-Za-z0-9][^\n.|–—]{3,60})/i,
    /application for[:\s]+([^\n|–—-]{4,60})/i,
    /role of[:\s]+([^\n|–—-]{4,60})/i,
    /position of[:\s]+([^\n|–—-]{4,60})/i,
    /for the\s+([A-Z][^\n,]{4,50}?)\s+(?:role|position|job)/i,
    /\b((?:Senior|Staff|Principal|Junior|Lead)\s+)?(?:Software|Frontend|Backend|Full[\s-]?Stack|Data|ML|Product|DevOps|SRE|iOS|Android|Mobile)?\s*(?:Engineer|Developer|Designer|Manager|Scientist|Analyst|Intern)\b/i,
  ];
  // Prefer subject line
  for (const hay of [subject, body.slice(0, 1500)]) {
    for (const p of patterns) {
      const m = hay.match(p);
      if (m?.[1] || m?.[0]) {
        const t = cleanTitle(m[1] || m[0]);
        if (t.length >= 4 && !/application|received|thanks/i.test(t)) return t;
      }
    }
  }
  return undefined;
}

function extractCompanyFromBody(subject: string, body: string): string | undefined {
  const patterns = [
    /at\s+([A-Z][A-Za-z0-9&.\- ]{1,40})\s+(?:team|hiring|recruiting)/,
    /opportunity at\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/i,
    /join\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/i,
    /(?:from|@)\s+([A-Z][A-Za-z0-9&.\- ]{1,30})\s+Recruiting/i,
  ];
  const hay = `${subject}\n${body.slice(0, 1500)}`;
  for (const p of patterns) {
    const m = hay.match(p);
    if (m?.[1]) {
      const name = m[1].trim().replace(/\s+/g, " ");
      if (name.length >= 2 && !/application|interview|position/i.test(name)) {
        return name;
      }
    }
  }
  return undefined;
}

function extractDates(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/g,
    /\b(?:tomorrow|today|next week|this Friday|this Monday)\b/gi,
  ];
  for (const p of patterns) {
    const matches = text.match(p) || [];
    for (const m of matches.slice(0, 5)) out.add(m.trim());
  }
  return [...out].slice(0, 8);
}

function extractSalary(text: string): string | undefined {
  const m = text.match(
    /\$\s?[\d,]+k?(?:\s*[-–—to]+\s*\$?\s?[\d,]+k?)?(?:\s*(?:USD|\/yr|per year|base))?/i
  );
  return m?.[0]?.trim();
}

function extractCalendarLinks(text: string): string[] {
  const links =
    text.match(
      /https?:\/\/(?:calendly\.com|cal\.com|calendar\.google\.com|outlook\.office(?:365)?\.com|scheduleonce\.com|savvycal\.com)[^\s<>)"]+/gi
    ) || [];
  return [...new Set(links)].slice(0, 5);
}

function guessSentiment(
  classificationHint: string | undefined,
  text: string
): "positive" | "neutral" | "negative" {
  if (classificationHint === "REJECTION") return "negative";
  if (classificationHint === "OFFER_RECEIVED") return "positive";
  if (/\bunfortunately\b|\bregret\b|\bnot selected\b/i.test(text)) return "negative";
  if (/\bcongratulat|\bexcited to|\bpleased to\b|\blooking forward\b/i.test(text))
    return "positive";
  return "neutral";
}

function parseFromName(fromName?: string, fromEmail?: string): string {
  if (fromName?.trim()) return fromName.trim().replace(/"/g, "");
  if (fromEmail) {
    const local = fromEmail.split("@")[0] || "";
    return local
      .replace(/[._]/g, " ")
      .replace(/\d+/g, "")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
  return "Unknown";
}

export function extractEntities(input: {
  subject: string;
  bodyText: string;
  fromEmail?: string;
  fromName?: string;
  classification?: string;
}): ExtractedEntities {
  const subject = input.subject || "";
  const body = input.bodyText || "";
  const text = `${subject}\n${body}`;
  const domain = domainFromEmail(input.fromEmail);
  const companyName =
    companyFromDomain(domain) ||
    extractCompanyFromBody(subject, body) ||
    undefined;

  return {
    companyName,
    jobTitle: extractJobTitle(subject, body),
    contactName: parseFromName(input.fromName, input.fromEmail),
    contactEmail: input.fromEmail?.toLowerCase(),
    domain,
    dates: extractDates(text),
    salaryHint: extractSalary(text),
    calendarLinks: extractCalendarLinks(text),
    sentiment: guessSentiment(input.classification, text),
  };
}
