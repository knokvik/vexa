import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { predictShortlist } from "./shortlist";

describe("shortlist", () => {
  it("returns factors and probability in range", () => {
    const result = predictShortlist({
      profile: {
        skills: [{ id: "1", name: "React", proficiency: "expert" }],
        yearsExperience: 7,
        preferredLocations: ["remote"],
      },
      job: {
        title: "Senior Frontend",
        skillsRequired: ["React", "TypeScript"],
        experienceLevel: "senior",
        location: { remote: true },
        postedAt: new Date().toISOString(),
      },
      ats: {
        overallScore: 80,
        keywordMatchScore: 80,
        semanticScore: 50,
        formatScore: 90,
        experienceScore: 85,
        missingKeywords: [],
        matchedKeywords: ["react"],
        suggestions: [],
      },
    });
    assert.ok(result.probability >= 0 && result.probability <= 1);
    assert.ok(result.factors.length >= 3);
  });
});
