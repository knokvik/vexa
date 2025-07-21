import { NextResponse } from "next/server";
import type { JobListing } from "@vexa/shared";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ jobs: store.listJobs() });
}

/** Ingest jobs from adapters (Firecrawl/manual). Public listings only. */
export async function POST(request: Request) {
  const body = await request.json();
  const jobs = (body.jobs ?? []) as JobListing[];
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ error: "jobs array required" }, { status: 400 });
  }
  const updated = store.upsertJobs(
    jobs.map((j) => ({
      ...j,
      status: j.status ?? "active",
      scrapedAt: j.scrapedAt ?? new Date().toISOString(),
      location: j.location ?? { remote: false },
      requirements: j.requirements ?? [],
      responsibilities: j.responsibilities ?? [],
      skillsRequired: j.skillsRequired ?? [],
      employmentType: j.employmentType ?? "unknown",
      experienceLevel: j.experienceLevel ?? "unknown",
    }))
  );
  return NextResponse.json({ jobs: updated, count: jobs.length });
}
