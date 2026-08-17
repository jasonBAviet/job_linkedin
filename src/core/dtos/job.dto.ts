export type JobRoleCategory = "BUSINESS_ANALYST" | "DATA_ANALYST" | "HYBRID_BA_DA";

export type SeniorityLevel = "INTERN" | "FRESHER" | "JUNIOR" | "MIDDLE" | "SENIOR" | "LEAD_MANAGER";

export type WorkLocation = "HO_CHI_MINH" | "DONG_NAI" | "REMOTE" | "HYBRID";

export type WorkMode = "ON_SITE" | "HYBRID" | "REMOTE";

export type ApplyType = "EASY_APPLY" | "EXTERNAL_APPLY";

export type DatePostedFilter = "ALL" | "PAST_24H" | "PAST_WEEK" | "PAST_MONTH";

export interface SkillRequirement {
  name: string;
  category: "CORE" | "SECONDARY" | "TOOL" | "DOMAIN" | "SOFT_SKILL";
  importance: "MUST_HAVE" | "GOOD_TO_HAVE";
  yearsRequired?: number;
}

/** Nguồn gốc dữ liệu của một tin tuyển dụng */
export type JobDataSource =
  | "LINKEDIN_VOYAGER"
  | "LINKEDIN_JSONLD"
  | "LINKEDIN_DOM"
  | "LINKEDIN_GUEST"
  | "MANUAL_JD";

export type CompetitionLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

/** Trang thai phan loai cua nguoi dung doi voi tung job */
export type JobUserStatus = "NEW" | "SAVED" | "VIEWED" | "HIDDEN";

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
  /** Chuỗi gốc của LinkedIn, phần lớn là tương đối: "2 weeks ago", "3 ngày trước" */
  postedDate: string;
  /** postedDate đã quy về ngày tuyệt đối "YYYY-MM-DD" — dùng để so sánh/sắp xếp */
  postedAt?: string;
  crawledAt?: string;
  isHot?: boolean;
  workMode: WorkMode;
  isEasyApply?: boolean;
  applyType?: ApplyType;
  experienceYearsRequired?: number;
  applicantCountText?: string;
  applicantCount?: number;
  competitionLevel?: CompetitionLevel;
  isPromoted?: boolean;
  responsesManagedOffLinkedIn?: boolean;
  isActivelyReviewing?: boolean;
  rawContent?: string;
  rawBadges?: string[];
  dataSource?: JobDataSource;
  inferredFields?: string[];
  missingFields?: string[];
  /** Trạng thái phân loại của người dùng, được API gắn vào khi trả về */
  userStatus?: JobUserStatus;
}

export interface JobSearchFilters {
  keyword?: string;
  company?: string;
  location?: WorkLocation | "ALL";
  roleCategory?: JobRoleCategory | "ALL";
  seniority?: SeniorityLevel | "SENIOR_AND_ABOVE" | "ALL";
  datePosted?: DatePostedFilter;
  workMode?: WorkMode | "ALL";
  applyType?: ApplyType | "ALL";
  isEasyApply?: boolean;
  competitionLevel?: CompetitionLevel | "ALL";
  minExperienceYears?: number;
  minSalaryVND?: number;
  minScore?: number;
  hasSalary?: boolean;
  userStatus?: JobUserStatus | "ALL";
}

