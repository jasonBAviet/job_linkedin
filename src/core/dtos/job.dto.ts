export type JobRoleCategory = "BUSINESS_ANALYST" | "DATA_ANALYST" | "HYBRID_BA_DA";

export type SeniorityLevel = "INTERN" | "FRESHER" | "JUNIOR" | "MIDDLE" | "SENIOR" | "LEAD_MANAGER";

export type WorkLocation = "HO_CHI_MINH" | "DONG_NAI" | "REMOTE" | "HYBRID";

export interface SkillRequirement {
  name: string;
  category: "CORE" | "SECONDARY" | "TOOL" | "DOMAIN" | "SOFT_SKILL";
  importance: "MUST_HAVE" | "GOOD_TO_HAVE";
  yearsRequired?: number;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: WorkLocation;
  locationDetails: string;
  roleCategory: JobRoleCategory;
  seniority: SeniorityLevel;
  salaryRange?: {
    min?: number;
    max?: number;
    currency: "VND" | "USD";
    isNegotiable?: boolean;
    display: string;
  };
  jobDescription: string;
  requirementsSummary: string[];
  responsibilitiesSummary: string[];
  extractedSkills: SkillRequirement[];
  linkedinUrl: string;
  postedDate: string;
  isHot?: boolean;
  workMode: "ON_SITE" | "HYBRID" | "REMOTE";
  experienceYearsRequired?: number;
  rawContent?: string;
  rawBadges?: string[];
}

export interface JobSearchFilters {
  keyword?: string;
  location?: WorkLocation | "ALL";
  roleCategory?: JobRoleCategory | "ALL";
  seniority?: SeniorityLevel | "SENIOR_AND_ABOVE" | "ALL";
  minExperienceYears?: number;
  minSalaryVND?: number;
  minScore?: number;
  workMode?: string;
  hasSalary?: boolean;
}


