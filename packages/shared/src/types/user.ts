export type UserRole = "free" | "pro" | "enterprise";
export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export type SkillProficiency =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export interface Skill {
  id: string;
  name: string;
  proficiency: SkillProficiency;
  years?: number;
  category?: "technical" | "soft" | "language" | "tool";
}

export interface Experience {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description?: string;
  achievements?: string[];
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  coursework?: string[];
  honors?: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  url?: string;
  technologies?: string[];
  bullets?: string[];
}

export interface LeadershipItem {
  id: string;
  organization: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets?: string[];
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  headline?: string;
  summary?: string;
  location?: string;
  phone?: string;
  /** Used for ATS contact line; optional in demo */
  email?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  preferredLocations: string[];
  preferredIndustries: string[];
  yearsExperience?: number;
  skills: Skill[];
  experiences: Experience[];
  education?: Education[];
  projects?: ProjectItem[];
  leadership?: LeadershipItem[];
  certifications?: string[];
  languages?: string[];
  interests: string[];
  templatePriorities: string[];
}
