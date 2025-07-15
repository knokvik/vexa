import type {
  JobListing,
  Profile,
  ResumeContent,
  ResumeSection,
} from "@vexa/shared";
import { humanizeText } from "./humanize";
import { scoreAts } from "./ats";
import { predictShortlist } from "./shortlist";

function pickTemplateId(priorities: string[]): string {
  return priorities[0] ?? "tpl-modern";
}

function buildSummary(profile: Profile, job: JobListing): string {
  const skills = profile.skills
    .slice(0, 5)
    .map((s) => s.name)
    .join(", ");
  const raw = [
    profile.summary?.trim() ||
      `${profile.fullName.split(" ")[0]} is a ${profile.headline ?? "professional"} with ${profile.yearsExperience ?? "several"} years of experience.`,
    `Interested in ${job.title} at ${job.company}.`,
    skills ? `Core strengths: ${skills}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return humanizeText(raw).text;
}

export interface BuiltResumePackage {
  templateId: string;
  content: ResumeContent;
  plainText: string;
  humanizedScore: number;
  atsScore: number;
  shortlistProbability: number;
  shortlistFactors: ReturnType<typeof predictShortlist>["factors"];
  recommendation: string;
  atsSuggestions: string[];
  missingKeywords: string[];
}

export function buildTailoredResume(
  profile: Profile,
  job: JobListing
): BuiltResumePackage {
  const templateId = pickTemplateId(profile.templatePriorities);
  const summary = buildSummary(profile, job);

  const expSection: ResumeSection = {
    id: "experience",
    type: "experience",
    title: "Experience",
    order: 2,
    content: profile.experiences.map((e) => {
      const bullets = (e.achievements ?? []).join("; ");
      const range = `${e.startDate} – ${e.isCurrent ? "Present" : e.endDate ?? ""}`;
      return `${e.title} @ ${e.company} (${range})${bullets ? `: ${bullets}` : e.description ? `: ${e.description}` : ""}`;
    }),
  };

  // Light keyword weave: append unmatched job skills that user already has.
  const profileSkillNames = new Set(
    profile.skills.map((s) => s.name.toLowerCase())
  );
  const weave = job.skillsRequired.filter((s) =>
    [...profileSkillNames].some((p) => p.includes(s.toLowerCase()))
  );

  const skillsContent = uniqueSkills([
    ...profile.skills.map((s) => s.name),
    ...weave,
  ]);

  const content: ResumeContent = {
    fullName: profile.fullName,
    headline: profile.headline ?? job.title,
    contact: {
      email: undefined,
      phone: profile.phone,
      location: profile.location,
      links: [profile.linkedinUrl, profile.githubUrl, profile.portfolioUrl].filter(
        Boolean
      ) as string[],
    },
    sections: [
      {
        id: "summary",
        type: "summary",
        title: "Summary",
        order: 1,
        content: summary,
      },
      expSection,
      {
        id: "skills",
        type: "skills",
        title: "Skills",
        order: 3,
        content: skillsContent,
      },
    ],
  };

  const plainText = [
    content.fullName,
    content.headline,
    summary,
    ...((expSection.content as string[]) ?? []),
    skillsContent.join(", "),
  ].join("\n");

  const human = humanizeText(plainText);
  const ats = scoreAts(content, job);
  const shortlist = predictShortlist({ profile, job, ats });

  return {
    templateId,
    content,
    plainText: human.text,
    humanizedScore: human.score,
    atsScore: ats.overallScore,
    shortlistProbability: shortlist.probability,
    shortlistFactors: shortlist.factors,
    recommendation: shortlist.recommendation,
    atsSuggestions: ats.suggestions,
    missingKeywords: ats.missingKeywords,
  };
}

function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}
