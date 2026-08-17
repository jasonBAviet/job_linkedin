import "server-only";
import { JobPosting, SkillRequirement } from "../dtos/job.dto";
import { canonicalUrl, contentKey, extractLinkedInJobId } from "../utils/job-key";
import { parsePostedDate } from "../utils/posted-date";

/**
 * Ba tầng khoá khử trùng lặp của một job, sinh từ đúng một nơi để tầng repository
 * và tầng mapper không bao giờ lệch nhau.
 *  - tầng 1 linkedinJobId: id số thật của LinkedIn (chắc chắn nhất, có thể null)
 *  - tầng 2 url:           URL đã chuẩn hoá (bắt trùng khi cùng job vào từ trang search)
 *  - tầng 3 contentKey:    hash(title + company + location) — bắt tin ĐĂNG LẠI với id mới
 */
export interface JobDedupKeys {
  linkedinJobId: string | null;
  url: string;
  contentKey: string;
}

export function jobDedupKeys(job: JobPosting): JobDedupKeys {
  const linkedinJobId = extractLinkedInJobId(job.linkedinUrl, job.id);
  return {
    linkedinJobId,
    url: canonicalUrl(job.linkedinUrl, linkedinJobId) || job.linkedinUrl || "",
    contentKey: contentKey(job.title, job.company, job.location),
  };
}

/** Một dòng của bảng `jobs` (snake_case). */
export interface JobRow {
  id: string;
  linkedin_job_id: string | null;
  linkedin_url: string;
  content_key: string;
  title: string;
  company: string;
  company_logo: string | null;
  location: string;
  location_details: string;
  role_category: string;
  seniority: string;
  work_mode: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_is_negotiable: boolean | null;
  salary_display: string | null;
  job_description: string;
  raw_content: string | null;
  raw_badges: string[];
  requirements_summary: string[];
  responsibilities_summary: string[];
  extracted_skills: SkillRequirement[];
  posted_date: string;
  /** DATE -> giữ nguyên chuỗi "YYYY-MM-DD" (xem type parser 1082 ở db/client.ts) */
  posted_at: string | null;
  crawled_at: Date | null;
  is_hot: boolean;
  is_easy_apply: boolean | null;
  apply_type: string | null;
  experience_years_required: number | null;
  applicant_count: number | null;
  applicant_count_text: string | null;
  competition_level: string | null;
  is_promoted: boolean | null;
  is_actively_reviewing: boolean | null;
  responses_managed_off_linkedin: boolean | null;
  user_status: string;
  data_source: string | null;
  inferred_fields: string[];
  missing_fields: string[];
}

/** Nơi DUY NHẤT chuyển snake_case -> camelCase và gom lại salaryRange. */
export function rowToJobPosting(r: JobRow): JobPosting {
  const hasSalary =
    r.salary_min !== null || r.salary_max !== null || r.salary_display !== null;

  return {
    id: r.id,
    title: r.title,
    company: r.company,
    companyLogo: r.company_logo ?? undefined,
    location: r.location as JobPosting["location"],
    locationDetails: r.location_details,
    roleCategory: r.role_category as JobPosting["roleCategory"],
    seniority: r.seniority as JobPosting["seniority"],
    salaryRange: hasSalary
      ? {
          min: r.salary_min ?? undefined,
          max: r.salary_max ?? undefined,
          currency: (r.salary_currency as "VND" | "USD") || "VND",
          isNegotiable: r.salary_is_negotiable ?? undefined,
          display: r.salary_display || "",
        }
      : undefined,
    jobDescription: r.job_description,
    requirementsSummary: r.requirements_summary || [],
    responsibilitiesSummary: r.responsibilities_summary || [],
    extractedSkills: r.extracted_skills || [],
    linkedinUrl: r.linkedin_url,
    postedDate: r.posted_date || "",
    postedAt: r.posted_at ?? undefined,
    crawledAt: r.crawled_at ? r.crawled_at.toISOString() : undefined,
    isHot: r.is_hot,
    workMode: r.work_mode as JobPosting["workMode"],
    isEasyApply: r.is_easy_apply ?? undefined,
    applyType: (r.apply_type as JobPosting["applyType"]) ?? undefined,
    experienceYearsRequired: r.experience_years_required ?? undefined,
    applicantCount: r.applicant_count ?? undefined,
    applicantCountText: r.applicant_count_text ?? undefined,
    competitionLevel: (r.competition_level as JobPosting["competitionLevel"]) ?? undefined,
    isPromoted: r.is_promoted ?? undefined,
    isActivelyReviewing: r.is_actively_reviewing ?? undefined,
    responsesManagedOffLinkedIn: r.responses_managed_off_linkedin ?? undefined,
    // raw_content để NULL khi trùng khít job_description -> trả lại giá trị đã gộp
    rawContent: r.raw_content ?? r.job_description,
    rawBadges: r.raw_badges || [],
    dataSource: (r.data_source as JobPosting["dataSource"]) ?? undefined,
    inferredFields: r.inferred_fields || [],
    missingFields: r.missing_fields || [],
  };
}

/** Thứ tự cột dùng chung cho INSERT và mảng tham số. */
export const JOB_COLUMNS = [
  "id", "linkedin_job_id", "linkedin_url", "content_key", "title", "company", "company_logo",
  "location", "location_details", "role_category", "seniority", "work_mode",
  "salary_min", "salary_max", "salary_currency", "salary_is_negotiable", "salary_display",
  "job_description", "raw_content", "raw_badges", "requirements_summary", "responsibilities_summary",
  "extracted_skills", "posted_date", "posted_at", "crawled_at", "is_hot", "is_easy_apply", "apply_type",
  "experience_years_required", "applicant_count", "applicant_count_text", "competition_level",
  "is_promoted", "is_actively_reviewing", "responses_managed_off_linkedin",
  "data_source", "inferred_fields", "missing_fields",
] as const;

/** camelCase -> mảng tham số theo đúng thứ tự JOB_COLUMNS. */
export function jobPostingToParams(job: JobPosting): unknown[] {
  const keys = jobDedupKeys(job);
  const jd = job.jobDescription || "";
  const raw = job.rawContent || "";
  const sr = job.salaryRange;

  return [
    job.id,
    keys.linkedinJobId,
    keys.url,
    keys.contentKey,
    job.title,
    job.company,
    job.companyLogo ?? null,
    job.location,
    job.locationDetails || "",
    job.roleCategory,
    job.seniority,
    job.workMode,
    sr?.min ?? null,
    sr?.max ?? null,
    sr?.currency ?? null,
    sr?.isNegotiable ?? null,
    sr?.display ?? null,
    jd,
    // Chỉ lưu rawContent khi THỰC SỰ khác jobDescription (100% bản ghi hiện tại trùng khít)
    raw && raw !== jd ? raw : null,
    job.rawBadges || [],
    job.requirementsSummary || [],
    job.responsibilitiesSummary || [],
    JSON.stringify(job.extractedSkills || []),
    job.postedDate || "",
    parsePostedDate(job.postedDate, job.crawledAt).postedAt,
    job.crawledAt ?? null,
    job.isHot ?? false,
    job.isEasyApply ?? null,
    job.applyType ?? null,
    job.experienceYearsRequired ?? null,
    job.applicantCount ?? null,
    job.applicantCountText ?? null,
    job.competitionLevel ?? null,
    job.isPromoted ?? null,
    job.isActivelyReviewing ?? null,
    job.responsesManagedOffLinkedIn ?? null,
    job.dataSource ?? null,
    job.inferredFields || [],
    job.missingFields || [],
  ];
}
