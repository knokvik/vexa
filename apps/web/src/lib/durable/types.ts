/**
 * Durable layer types — mirrors Phase-1 schema in gap-closing plan.
 * Stored as JSON tables under apps/web/data/durable/ (swap to SQLite later).
 */

export type JobRowStatus =
  | "new"
  | "scored"
  | "drafted"
  | "queued"
  | "submitted"
  | "archived";

export type OutcomeEvent =
  | "viewed"
  | "no_response"
  | "rejected"
  | "phone_screen"
  | "onsite"
  | "offer"
  | "withdrawn";

export type JobRow = {
  id: string;
  source: string;
  company: string;
  title: string;
  location: string;
  url: string;
  jd_raw: string;
  discovered_at: string;
  status: JobRowStatus;
  /** Full JobListing blob for app compatibility */
  listing_json: string;
};

export type ScoreRow = {
  job_id: string;
  skills_match: number;
  seniority_fit: number;
  location_comp_fit: number;
  domain_fit: number;
  overall_confidence: number;
  reasoning: string;
  missing_requirements: string; // JSON array
  scored_at: string;
  model_used: string;
};

export type ApplicationRow = {
  id: string;
  job_id: string;
  resume_variant_id: string;
  template_used: string;
  tier: number;
  submitted_at: string | null;
  submission_method: string | null;
  confirmation_seen: number;
  confirmation_evidence: string | null;
  /** Full ApplicationDraft blob */
  draft_json: string;
  /** Latest outcome event for quick UI */
  latest_outcome?: OutcomeEvent | null;
};

export type OutcomeRow = {
  id: string;
  application_id: string;
  event: OutcomeEvent;
  event_at: string;
  note: string;
};

export type FollowUpRow = {
  outreach_id: string;
  scheduled_at: string;
  sent: number;
  company: string;
  to_email: string;
  subject: string;
};

export type DurableSnapshot = {
  version: 1;
  updatedAt: string;
  jobs: JobRow[];
  scores: ScoreRow[];
  applications: ApplicationRow[];
  outcomes: OutcomeRow[];
  follow_ups: FollowUpRow[];
  profile_json: string | null;
  resumes_json: string;
  platforms_json: string | null;
};
