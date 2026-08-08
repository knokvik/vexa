import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JobListing, Profile } from "@vexa/shared";
import {
  buildResume,
  ensureActionBullet,
  renderAtsPlainText,
} from "./resume-builder";
import { listPrimaryTemplates, resolveTemplateId } from "./templates";

const profile: Profile = {
  id: "p1",
  userId: "u1",
  fullName: "Alex Rivera",
  headline: "Senior Frontend Engineer",
  email: "alex@example.com",
  phone: "+1 415 555 0142",
  location: "San Francisco, CA",
  linkedinUrl: "https://linkedin.com/in/alex",
  githubUrl: "https://github.com/alex",
  preferredLocations: [],
  preferredIndustries: [],
  yearsExperience: 7,
  skills: [
    { id: "1", name: "React", proficiency: "expert", category: "technical" },
    {
      id: "2",
      name: "TypeScript",
      proficiency: "expert",
      category: "technical",
    },
  ],
  experiences: [
    {
      id: "e1",
      company: "Northline",
      title: "Senior Frontend Engineer",
      location: "Remote",
      startDate: "2022-03",
      isCurrent: true,
      achievements: [
        "Cut invoice error rate 40% with a new billing UI pipeline",
        "Shipped design system used by 12 product teams",
      ],
    },
  ],
  education: [
    {
      id: "ed1",
      school: "UC Berkeley",
      degree: "B.S.",
      field: "Computer Science",
      location: "Berkeley, CA",
      endDate: "2018-05",
      gpa: "3.7/4.0",
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Token CLI",
      bullets: ["Built CLI used by 3 orgs"],
      technologies: ["TypeScript"],
    },
  ],
  leadership: [
    {
      id: "l1",
      organization: "Frontend Guild",
      role: "Organizer",
      bullets: ["Hosted monthly deep-dives"],
    },
  ],
  interests: ["design systems"],
  templatePriorities: ["tpl-harvard"],
};

const job: JobListing = {
  id: "j1",
  source: "demo",
  externalUrl: "https://example.com/job",
  title: "Senior Frontend Engineer",
  company: "Stripe",
  location: { remote: true },
  description: "React TypeScript design systems",
  requirements: ["React", "TypeScript"],
  responsibilities: [],
  skillsRequired: ["React", "TypeScript", "Next.js"],
  employmentType: "full-time",
  experienceLevel: "senior",
  postedAt: new Date().toISOString(),
  status: "active",
  scrapedAt: new Date().toISOString(),
};

describe("resume templates", () => {
  it("lists 5 primary Ivy templates", () => {
    const t = listPrimaryTemplates();
    assert.equal(t.length, 5);
    assert.ok(t.every((x) => x.atsFriendlyScore >= 95));
  });

  it("aliases legacy template ids", () => {
    assert.equal(resolveTemplateId("tpl-modern"), "tpl-harvard");
    assert.equal(resolveTemplateId("tpl-technical"), "tpl-mit");
    assert.equal(resolveTemplateId("tpl-classic"), "tpl-penn");
  });

  it("ensures action-verb bullets", () => {
    assert.match(ensureActionBullet("responsible for billing UI"), /^Delivered/i);
    assert.match(ensureActionBullet("Cut error rate 40%"), /^Cut/);
  });

  it("builds Harvard resume with ATS structure", () => {
    const r = buildResume(profile, job, { templateId: "tpl-harvard" });
    assert.equal(r.templateId, "tpl-harvard");
    assert.ok(r.plainText.includes("ALEX RIVERA"));
    assert.ok(r.plainText.includes("EDUCATION"));
    assert.ok(r.plainText.includes("EXPERIENCE"));
    assert.ok(r.plainText.includes("SKILLS"));
    assert.ok(r.plainText.includes("• "));
    assert.ok(!r.plainText.includes("┌"));
    assert.ok(r.atsChecklist.filter((c) => c.ok).length >= 5);
    assert.ok(r.atsScore > 40);
    assert.ok(r.formatScore >= 80);
  });

  it("builds all primary templates without crash", () => {
    for (const id of [
      "tpl-harvard",
      "tpl-princeton",
      "tpl-yale",
      "tpl-mit",
      "tpl-penn",
    ]) {
      const r = buildResume(profile, null, { templateId: id, humanize: false });
      assert.ok(r.plainText.length > 100, id);
      const again = renderAtsPlainText(r.content);
      assert.ok(again.includes(profile.fullName.toUpperCase()));
    }
  });

  it("weaves job skills the profile already has", () => {
    const r = buildResume(profile, job, { templateId: "tpl-mit" });
    assert.ok(/React/i.test(r.plainText));
    assert.ok(/TypeScript/i.test(r.plainText));
  });
});
