import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreAts } from "./ats";

describe("ats", () => {
  it("scores higher when skills overlap", () => {
    const low = scoreAts("general worker", {
      title: "React Engineer",
      description: "React TypeScript design systems",
      skillsRequired: ["React", "TypeScript", "Design Systems"],
      requirements: [],
    });
    const high = scoreAts(
      "Senior React TypeScript engineer with design systems experience for 6 years",
      {
        title: "React Engineer",
        description: "React TypeScript design systems",
        skillsRequired: ["React", "TypeScript", "Design Systems"],
        requirements: [],
      }
    );
    assert.ok(high.overallScore > low.overallScore);
    assert.ok(typeof high.structuredScore === "number");
    assert.ok(high.explain?.thresholdGood === 70);
  });
});
