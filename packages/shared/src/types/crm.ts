/**
 * Email-native Job Search CRM — relationship graph, not a spreadsheet.
 * Server never auto-applies. Email is the universal signal.
 */

/** Pipeline stages (state machine) */
export type PipelineStage =
  | "wishlist"
  | "applied"
  | "screen"
  | "technical"
  | "onsite"
  | "offer"
  | "accepted"
  | "ghosted"
  | "rejected"
  | "withdrawn";

export const PIPELINE_STAGES: PipelineStage[] = [
  "wishlist",
  "applied",
  "screen",
  "technical",
  "onsite",
  "offer",
  "accepted",
  "ghosted",
  "rejected",
  "withdrawn",
];

/** Forward-only happy path + terminal exits */
export const PIPELINE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  wishlist: ["applied", "rejected", "withdrawn", "ghosted"],
  applied: ["screen", "technical", "rejected", "ghosted", "withdrawn"],
  screen: ["technical", "onsite", "rejected", "ghosted", "withdrawn"],
  technical: ["onsite", "offer", "rejected", "ghosted", "withdrawn"],
  onsite: ["offer", "rejected", "ghosted", "withdrawn"],
  offer: ["accepted", "rejected", "withdrawn"],
  accepted: [],
  ghosted: ["applied", "screen", "withdrawn"], // reopen if they come back
  rejected: [],
  withdrawn: [],
};

export type EmailClass =
  | "APPLICATION_CONFIRMED"
  | "REJECTION"
  | "SCREEN_INVITE"
  | "TECHNICAL_INVITE"
  | "ONSITE_INVITE"
  | "OFFER_RECEIVED"
  | "RECRUITER_OUTREACH"
  | "REFERRAL_REQUEST"
  | "FOLLOW_UP"
  | "GENERIC";

export type ContactRoleType =
  | "hr"
  | "recruiter"
  | "hiring_manager"
  | "interviewer"
  | "referral"
  | "peer"
  | "other";

export type RelationshipType =
  | "knows"
  | "referred"
  | "referred_by"
  | "worked_with"
  | "reports_to"
  | "interviewed_by"
  | "interviewed";

export type CrmEventType =
  | "screen"
  | "technical"
  | "onsite"
  | "call"
  | "meeting"
  | "offer_deadline"
  | "follow_up_task"
  | "coding_challenge"
  | "other";

export type ApplicationSource =
  | "linkedin"
  | "referral"
  | "direct"
  | "recruiter_outreach"
  | "email"
  | "job_board"
  | "other";

export interface CrmCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  careerPageUrl?: string;
  notes?: string;
  healthSignals?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  name: string;
  email: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  linkedinUrl?: string;
  roleType: ContactRoleType;
  /** 0–5 relationship strength */
  strength: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmJob {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  department?: string;
  location?: string;
  salaryRange?: string;
  postingDate?: string;
  sourceUrl?: string;
  requirements?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmApplication {
  id: string;
  jobId: string;
  companyId: string;
  companyName: string;
  jobTitle: string;
  stage: PipelineStage;
  appliedAt?: string;
  lastTouchAt: string;
  source: ApplicationSource;
  status: "active" | "closed";
  rejectionReason?: string;
  notes?: string;
  contactIds: string[];
  emailIds: string[];
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmEmail {
  id: string;
  messageId?: string;
  threadId?: string;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
  classification: EmailClass;
  classificationConfidence: number;
  companyId?: string;
  contactId?: string;
  jobId?: string;
  applicationId?: string;
  extracted: {
    companyName?: string;
    jobTitle?: string;
    dates?: string[];
    salaryHint?: string;
    calendarLinks?: string[];
    sentiment?: "positive" | "neutral" | "negative";
  };
  rawMeta?: Record<string, unknown>;
  createdAt: string;
}

export interface CrmEvent {
  id: string;
  type: CrmEventType;
  title: string;
  datetime?: string;
  endDatetime?: string;
  applicationId?: string;
  companyId?: string;
  contactIds: string[];
  prepNotes?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmRelationship {
  id: string;
  fromContactId: string;
  toContactId: string;
  type: RelationshipType;
  strength: number;
  note?: string;
  createdAt: string;
}

export interface CrmAction {
  id: string;
  kind:
    | "follow_up"
    | "prep"
    | "decide_offer"
    | "log_rejection"
    | "reply"
    | "schedule"
    | "other";
  title: string;
  detail?: string;
  dueAt?: string;
  applicationId?: string;
  companyId?: string;
  contactId?: string;
  priority: "high" | "medium" | "low";
  done: boolean;
  createdAt: string;
}

/** Personal / company work items (not only job applications) */
export type UserTaskKind =
  | "job"
  | "conference"
  | "company"
  | "personal"
  | "interview"
  | "other";

export interface CrmUserTask {
  id: string;
  title: string;
  kind: UserTaskKind;
  companyId?: string;
  companyName?: string;
  applicationId?: string;
  dueAt?: string;
  notes?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Saved canvas positions for graph nodes */
export type GraphNodeLayout = Record<
  string,
  { x: number; y: number }
>;

export interface CrmSnapshot {
  version: 1;
  updatedAt: string;
  companies: CrmCompany[];
  contacts: CrmContact[];
  jobs: CrmJob[];
  applications: CrmApplication[];
  emails: CrmEmail[];
  events: CrmEvent[];
  relationships: CrmRelationship[];
  actions: CrmAction[];
  userTasks?: CrmUserTask[];
  graphLayout?: GraphNodeLayout;
}
