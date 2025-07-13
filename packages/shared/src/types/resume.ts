export type TemplateCategory =
  | "modern"
  | "classic"
  | "creative"
  | "minimal"
  | "technical";

export interface ResumeTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  isPremium: boolean;
  atsFriendlyScore: number;
  description?: string;
}

export interface ResumeSection {
  id: string;
  type: "summary" | "experience" | "skills" | "education" | "projects" | "custom";
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
