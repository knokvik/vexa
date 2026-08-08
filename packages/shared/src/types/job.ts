export type JobSource =
  | "firecrawl"
  | "exa"
  | "bright_data"
  | "greenhouse"
  | "lever"
  | "remoteok"
  | "adzuna"
  | "indeed"
  | "remotive"
  | "arbeitnow"
  | "jobicy"
  | "himalayas"
  | "weworkremotely"
  | "manual"
  | "demo";

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship"
  | "unknown";

export type ExperienceLevel =
  | "entry"
  | "mid"
  | "senior"
  | "executive"
  | "unknown";

export type JobStatus = "active" | "expired" | "filled" | "removed";

export interface JobLocation {
  raw?: string;
  city?: string;
  state?: string;
  country?: string;
  remote: boolean;
}

export interface JobSalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "hourly" | "yearly" | "monthly";
}

export interface JobListing {
  id: string;
  source: JobSource;
  sourceId?: string;
  externalUrl: string;
  title: string;
  company: string;
  location: JobLocation;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skillsRequired: string[];
  salary?: JobSalary;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  postedAt?: string;
  expiresAt?: string;
  status: JobStatus;
  scrapedAt: string;
  easyApply?: boolean;
}
