import type { JobListing, Profile, ShortlistFactor } from "@vexa/shared";
import type { AtsReport } from "./ats";

export interface ShortlistResult {
  probability: number;
  confidence: number;
  factors: ShortlistFactor[];
  recommendation: string;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * v0 shortlisting predictor: rule + ATS blend with factor breakdown.
 * Later: trained model on outcomes.
 */
export function predictShortlist(input: {
  profile: Pick<Profile, "skills" | "yearsExperience" | "preferredLocations">;
  job: Pick<
    JobListing,
    "skillsRequired" | "experienceLevel" | "location" | "title" | "postedAt"
  >;
  ats: AtsReport;
  matchScore?: number;
}): ShortlistResult {
  const { profile, job, ats } = input;
  const factors: ShortlistFactor[] = [];

  const profileSkills = new Set(
    profile.skills.map((s) => s.name.toLowerCase())
  );
  const required = job.skillsRequired.map((s) => s.toLowerCase());
  const skillHits =
    required.length === 0
      ? 0.7
      : required.filter((s) =>
          [...profileSkills].some((p) => p.includes(s) || s.includes(p))
        ).length / required.length;

  factors.push({
    factor: "skills_match",
    impact: 0.35,
    score: skillHits,
    note: `${Math.round(skillHits * 100)}% of required skills covered`,
  });

  const years = profile.yearsExperience ?? 0;
  const levelNeed: Record<string, number> = {
    entry: 0,
    mid: 3,
    senior: 6,
    executive: 12,
    unknown: 2,
  };
  const need = levelNeed[job.experienceLevel] ?? 2;
  const expRatio = need === 0 ? 1 : clamp01(years / need);
  const expGap = expRatio >= 1 ? 0 : expRatio - 1;
  factors.push({
    factor: "experience_alignment",
    impact: 0.2,
    score: expRatio,
    note:
      expRatio >= 1
        ? "Experience meets level bar"
        : `Gap vs typical ${job.experienceLevel} bar`,
  });

  factors.push({
    factor: "ats_fit",
    impact: 0.25,
    score: ats.overallScore / 100,
    note: `ATS score ${ats.overallScore}`,
  });

  // Freshness: newer posts slightly better odds of visibility.
  let freshness = 0.7;
  if (job.postedAt) {
    const days =
      (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60 * 24);
    freshness = clamp01(1 - days / 30);
  }
  factors.push({
    factor: "posting_freshness",
    impact: 0.1,
    score: freshness,
  });

  const remoteOk = job.location.remote;
  const wantsRemote = profile.preferredLocations.some((l) =>
    /remote/i.test(l)
  );
  const locationScore = remoteOk || wantsRemote ? 0.85 : 0.65;
  factors.push({
    factor: "location_fit",
    impact: 0.1,
    score: locationScore,
  });

  const probability = clamp01(
    factors.reduce((sum, f) => sum + f.impact * f.score, 0)
  );

  // Confidence higher when skills list is rich and ATS clear.
  const confidence = clamp01(
    0.45 +
      (required.length > 3 ? 0.2 : 0.05) +
      (ats.overallScore > 70 ? 0.2 : 0.05) +
      (Math.abs(expGap) < 0.2 ? 0.1 : 0)
  );

  let recommendation: string;
  if (probability >= 0.85) {
    recommendation = "Strong fit — ready for one-tap apply.";
  } else if (probability >= 0.72) {
    recommendation = "Good fit — review resume tweaks, then apply.";
  } else {
    recommendation =
      "Below target — improve keyword weave or skip to protect response rate.";
  }

  return {
    probability: Math.round(probability * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    factors,
    recommendation,
  };
}
