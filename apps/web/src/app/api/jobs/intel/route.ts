import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { scanJobIntel } from "@/lib/job-intel";
import type { JobListing } from "@vexa/shared";

/**
 * POST /api/jobs/intel
 * Body: { jobId?: string, job?: JobListing }
 * Scans job mentions + people/projects at company. No apply yet.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let job: JobListing | undefined;

    if (body.jobId) {
      job = store.getJob(String(body.jobId));
    }
    if (!job && body.job) {
      job = body.job as JobListing;
      // ensure in store for later prepare
      store.upsertJobs([job]);
    }
    if (!job) {
      return NextResponse.json(
        { error: "jobId or job object required" },
        { status: 400 }
      );
    }

    const profile = store.getProfile();
    const intel = await scanJobIntel(job, profile);

    return NextResponse.json({ ok: true, intel });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "intel scan failed",
      },
      { status: 502 }
    );
  }
}
