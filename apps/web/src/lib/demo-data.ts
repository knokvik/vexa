import type { ApplicationDraft, JobListing, Profile } from "@vexa/shared";

export const DEMO_USER_ID = "user_demo_1";

export const DEMO_PROFILE: Profile = {
  id: "profile_demo_1",
  userId: DEMO_USER_ID,
  fullName: "Alex Rivera",
  headline: "Senior Frontend Engineer",
  summary:
    "I build design systems and product UI that ship. 7 years across startups and growth-stage teams, focused on React, TypeScript, and accessible craft.",
  location: "San Francisco, CA",
  phone: "+1 415 555 0142",
  linkedinUrl: "https://linkedin.com/in/alexrivera",
  githubUrl: "https://github.com/alexrivera",
  portfolioUrl: "https://alexrivera.dev",
  desiredSalaryMin: 160000,
  desiredSalaryMax: 210000,
  preferredLocations: ["remote", "San Francisco", "New York"],
  preferredIndustries: ["SaaS", "Developer Tools", "Fintech"],
  yearsExperience: 7,
  skills: [
    { id: "s1", name: "React", proficiency: "expert", years: 6, category: "technical" },
    { id: "s2", name: "TypeScript", proficiency: "expert", years: 5, category: "technical" },
    { id: "s3", name: "Next.js", proficiency: "advanced", years: 3, category: "technical" },
    { id: "s4", name: "Design Systems", proficiency: "advanced", years: 4, category: "technical" },
    { id: "s5", name: "Node.js", proficiency: "intermediate", years: 3, category: "technical" },
    { id: "s6", name: "GraphQL", proficiency: "intermediate", years: 2, category: "technical" },
  ],
  experiences: [
    {
      id: "e1",
      company: "Northline",
      title: "Senior Frontend Engineer",
      location: "Remote",
      startDate: "2022-03",
      endDate: null,
      isCurrent: true,
      description: "Lead product UI for billing and growth surfaces.",
      achievements: [
        "Cut invoice error rate 40% with a new billing UI pipeline",
        "Shipped design system used by 12 product teams",
        "Mentored 4 engineers on accessibility and performance",
      ],
    },
    {
      id: "e2",
      company: "Parcel",
      title: "Frontend Engineer",
      location: "New York, NY",
      startDate: "2019-01",
      endDate: "2022-02",
      isCurrent: false,
      achievements: [
        "Rebuilt checkout in React; +12% conversion",
        "Introduced TypeScript across web monorepo",
      ],
    },
  ],
  interests: ["design systems", "AI tooling", "developer experience"],
  templatePriorities: ["tpl-modern", "tpl-technical", "tpl-classic"],
};

export const DEMO_JOBS: JobListing[] = [
  {
    id: "job_1",
    source: "demo",
    externalUrl: "https://boards.greenhouse.io/example/jobs/1",
    title: "Senior Frontend Engineer",
    company: "Stripe",
    location: { city: "San Francisco", state: "CA", country: "US", remote: true },
    description:
      "Build revenue automation UI with React and TypeScript. Craftsmanship over speed. Design systems experience valued.",
    requirements: [
      "5+ years React",
      "Strong TypeScript",
      "Experience with design systems",
    ],
    responsibilities: [
      "Own complex product surfaces",
      "Partner with design on craft",
      "Improve web performance",
    ],
    skillsRequired: ["React", "TypeScript", "Design Systems", "Next.js", "GraphQL"],
    salary: { min: 180000, max: 240000, currency: "USD", period: "yearly" },
    employmentType: "full-time",
    experienceLevel: "senior",
    postedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: "active",
    scrapedAt: new Date().toISOString(),
    easyApply: true,
  },
  {
    id: "job_2",
    source: "demo",
    externalUrl: "https://jobs.lever.co/example/2",
    title: "Staff Frontend Engineer",
    company: "Figma",
    location: { city: "San Francisco", state: "CA", country: "US", remote: false },
    description:
      "Work on multiplayer canvas and editor performance. Deep React expertise required.",
    requirements: ["Staff-level frontend", "React", "Performance"],
    responsibilities: ["Lead technical design", "Mentor engineers"],
    skillsRequired: ["React", "TypeScript", "WebGL", "Performance"],
    employmentType: "full-time",
    experienceLevel: "senior",
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: "active",
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "job_3",
    source: "demo",
    externalUrl: "https://example.com/careers/notion-pe",
    title: "Product Engineer",
    company: "Notion",
    location: { raw: "Remote US", remote: true },
    description:
      "Full-stack product engineer for collaborative workflows. React + Node.",
    requirements: ["React", "Node.js", "Product sense"],
    responsibilities: ["Ship end-to-end features"],
    skillsRequired: ["React", "Node.js", "TypeScript", "Postgres"],
    employmentType: "full-time",
    experienceLevel: "mid",
    postedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: "active",
    scrapedAt: new Date().toISOString(),
  },
];

export const DEMO_DRAFTS: ApplicationDraft[] = [];
