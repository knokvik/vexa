export type TemplateCategory =
  | "modern"
  | "classic"
  | "creative"
  | "minimal"
  | "technical"
  | "ivy";

export type ResumeSectionType =
  | "summary"
  | "objective"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "leadership"
  | "additional"
  | "custom";

export interface ResumeTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  isPremium: boolean;
  atsFriendlyScore: number;
  description?: string;
  /** University / firm style this layout follows */
  styleSource?: string;
  /** Section order for plain-text ATS render */
  sectionOrder?: ResumeSectionType[];
  /** Single-column only for ATS */
  layout?: "single_column";
  fontFamily?: "Arial" | "Calibri" | "Times New Roman" | "Garamond" | "Trebuchet MS";
  bestFor?: string;
}

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: string | string[];
  order: number;
}

export interface ResumeContent {
  fullName: string;
  headline?: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  sections: ResumeSection[];
  /** Template used to render this content */
  templateId?: string;
}

export interface ResumeVersion {
  id: string;
  userId: string;
  jobListingId?: string | null;
  templateId: string;
  content: ResumeContent;
  plainText: string;
  pdfUrl?: string;
  docxUrl?: string;
  atsScore?: number;
  humanizedScore?: number;
  createdAt: string;
}
