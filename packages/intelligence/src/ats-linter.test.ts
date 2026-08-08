import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkInvention, lintAtsPlainText } from "./ats-linter";

describe("ats-linter", () => {
  it("passes clean single-column resume", () => {
    const text = `ALEX RIVERA
alex@example.com | San Francisco CA | linkedin.com/in/alex

EXPERIENCE
--------------------------------
Northline, Remote
Senior Frontend Engineer | Mar 2022 – Present
• Cut invoice error rate 40% with a new billing UI pipeline
• Shipped design system used by 12 product teams
• Mentored 4 engineers on accessibility and performance

Parcel, New York
Frontend Engineer | Jan 2019 – Feb 2022
• Rebuilt checkout in React with +12% conversion
• Introduced TypeScript across the web monorepo

SKILLS
--------------------------------
Technical: React, TypeScript, Next.js, GraphQL, Node.js

EDUCATION
--------------------------------
University of California Berkeley
B.S. Computer Science, May 2018
`;
    const r = lintAtsPlainText(text);
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.ok(r.score >= 70);
  });

  it("flags table-like layouts", () => {
    const r = lintAtsPlainText("a\n┌───┐\n│ x │\n└───┘\nEXPERIENCE\n• did stuff");
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.id === "tables_graphics"));
  });

  it("flags invented clearance", () => {
    const flags = checkInvention(
      "Held Top Secret clearance at work",
      "Alex Rivera React TypeScript Northline"
    );
    assert.ok(flags.some((f) => f.id === "invented_clearance"));
  });
});
