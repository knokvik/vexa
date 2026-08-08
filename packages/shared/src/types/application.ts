export type ApplicationStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "requires_review"
  | "submitted"
  | "failed"
  | "expired"
  | "duplicate";

export interface ShortlistFactor {
  factor: string;
  impact: number;
  score: number;
  note?: string;
}

export interface ShortlistingPrediction {
  id: string;
  applicationId: string;
  probability: number;
  confidence: number;
  factors: ShortlistFactor[];
  recommendation?: string;
  createdAt: string;
}

export interface ApplicationDraft {
  id: string;
  userId: string;
  jobListingId: string;
  resumeVersionId?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  matchScore?: number;
  shortlistProbability?: number;
  shortlistFactors?: ShortlistFactor[];
  filledFormData?: Record<string, string>;
  /** Per-field answers with ATS + human eval (form-fill engine) */
  formAnswers?: FormAnswerEval[];
  formEval?: FormFillEvalSummary;
  formSurface?: string;
  confirmationId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

/** One ATS form field answer with quality scores */
export interface FormAnswerEval {
  key: string;
  label: string;
  value: string;
  category: string;
  atsScore: number;
  humanScore: number;
  overall: number;
  notes?: string;
  aliases?: string[];
}

export interface FormFillEvalSummary {
  avgAts: number;
  avgHuman: number;
  avgOverall: number;
  fieldCount: number;
  readyCount: number;
  reviewCount: number;
  recommendation: string;
}

/** Payload sent to the Chrome extension for one-tap prefill. */
export interface ApplyPackage {
  applicationId: string;
  jobUrl: string;
  jobTitle: string;
  company: string;
  filledFormData: Record<string, string>;
  /** Structured answers for review + extension alias matching */
  formAnswers?: FormAnswerEval[];
  formEval?: FormFillEvalSummary;
  formSurface?: string;
  resumePlainText?: string;
  resumePdfUrl?: string;
  coverLetter?: string;
  /** Server never submits — extension only prefills. */
  autoSubmit: false;
}
