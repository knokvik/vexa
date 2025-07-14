import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateHumanizationScore, humanizeText } from "./humanize";

describe("humanize", () => {
  it("penalizes AI-ish phrases", () => {
    const bad =
      "In today's fast-paced world, I leverage cutting-edge solutions to deliver robust solutions.";
    const score = estimateHumanizationScore(bad).score;
    assert.ok(score < 85);
  });

  it("rewrites common tells", () => {
    const result = humanizeText(
      "I leverage modern tools and utilize data to delve into problems."
    );
    assert.equal(result.rewrote, true);
    assert.doesNotMatch(result.text, /leverage/i);
  });
});
