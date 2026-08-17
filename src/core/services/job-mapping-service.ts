import { ApplyType, JobDataSource, JobPosting, JobRoleCategory, SeniorityLevel, WorkLocation, WorkMode } from "../dtos/job.dto";
import { scoringService } from "./scoring-service";
import { getCompanyLogoUrl } from "../utils/logo-resolver";
import { DEFAULT_SYSTEM_CONFIG, SystemConfig } from "../constants/app-config";
import { SalaryExtractor } from "../utils/salary-extractor";
import { parseCompetitionAndMetadata } from "../utils/competition-parser";
import {
  classifyRole,
  classifySeniority as classifySeniorityFromText,
} from "../utils/role-classifier";

export class IngestError extends Error {
  public readonly code: string;
  public readonly missingFields: string[];

  constructor(code: string, message: string, missingFields: string[] = []) {
    super(message);
    this.name = "IngestError";
    this.code = code;
    this.missingFields = missingFields;
  }
}

const MIN_DESCRIPTION_LENGTH = 80;

export interface RawIngestedJob {
  id?: string;
  rawTitle?: string;
  title?: string;
  rawCompany?: string;
  company?: string;
  rawLocation?: string;
  locationDetails?: string;
  rawSalaryText?: string;
  salaryText?: string;
  rawContent?: string;
  jobDescription?: string;
  description?: string;
  rawBadges?: string[];
  pageUrl?: string;
  linkedinUrl?: string;
  url?: string;
  pageTitle?: string;
  companyLogo?: string;
  workMode?: WorkMode;
  isEasyApply?: boolean;
  applyType?: ApplyType;
  postedDate?: string;
  crawledAt?: string;
  timestamp?: string;
  linkedinJobId?: string | null;
  applicantCountText?: string;
  applicantCount?: number;
  dataSource?: JobDataSource;
  extractOk?: boolean;
  missingFields?: string[];
}

export class JobMappingService {
  private config: SystemConfig;

  constructor(customConfig?: Partial<SystemConfig>) {
    this.config = { ...DEFAULT_SYSTEM_CONFIG, ...customConfig };
  }

  public updateConfig(newConfig: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public mapRawToJobPosting(raw: RawIngestedJob, customConfig?: Partial<SystemConfig>): JobPosting {
    const activeConfig = customConfig ? { ...this.config, ...customConfig } : this.config;
    const rawContent = (raw.rawContent || raw.jobDescription || raw.description || "").trim();
    const rawBadges = raw.rawBadges || [];

    if (rawContent.length < MIN_DESCRIPTION_LENGTH) {
      throw new IngestError(
        "MISSING_DESCRIPTION",
        `Không đọc được mô tả công việc (chỉ ${rawContent.length} ký tự, cần tối thiểu ${MIN_DESCRIPTION_LENGTH}).`,
        ["jobDescription"]
      );
    }

    const title = this.resolveJobTitle(raw.rawTitle || raw.title, rawContent, raw.pageTitle);
    const company = this.resolveCompany(raw.rawCompany || raw.company, rawContent);
    const locationInfo = this.classifyLocation(raw.rawLocation || raw.locationDetails, rawContent, rawBadges, activeConfig);
    const roleInfo = this.classifyRoleCategory(title, rawContent, activeConfig);
    const seniorityInfo = this.classifySeniority(title, rawContent, activeConfig);
    const salaryRange = this.parseSalary(raw.rawSalaryText || raw.salaryText, rawContent, rawBadges, title, activeConfig);
    const workMode = this.classifyWorkMode(raw.workMode, rawContent, rawBadges);
    const { applyType, isEasyApply } = this.classifyApplyType(raw.applyType, rawBadges, rawContent, raw.isEasyApply);

    // Bóc tách thông tin ứng tuyển và mức độ cạnh tranh
    const competitionInfo = parseCompetitionAndMetadata({
      rawLocation: raw.rawLocation,
      locationDetails: raw.locationDetails,
      rawBadges,
      rawContent,
      postedDate: raw.postedDate,
    });

    // Không đưa tên công ty vào: "Fintech Solutions JSC" hay "Retail Group" sẽ tự tiêm
    // kỹ năng không hề có trong yêu cầu công việc.
    const fullTextForSkills = `${title} ${rawBadges.join(" ")} ${rawContent}`;
    const extractedSkills = scoringService.extractSkillsFromText(fullTextForSkills);
    const { responsibilities, requirements } = this.extractSummaries(rawContent);
    const companyLogo = getCompanyLogoUrl(company, raw.companyLogo);

    const sourceUrl = raw.linkedinUrl || raw.url || raw.pageUrl || "";
    const jobId = raw.linkedinJobId || this.extractLinkedInJobId(sourceUrl);
    const linkedinUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : sourceUrl;
    if (!raw.id && !jobId && !sourceUrl) {
      throw new IngestError("MISSING_IDENTITY", "Thiếu định danh việc làm (ID/URL).", ["linkedinUrl"]);
    }
    const id = raw.id || (jobId ? `li-${jobId}` : `url-${this.hashString(linkedinUrl)}`);

    const missingFields: string[] = [...(raw.missingFields || [])];
    if (!salaryRange) missingFields.push("salaryRange");
    if (!companyLogo) missingFields.push("companyLogo");
    if (!competitionInfo.parsedPostedDate) missingFields.push("postedDate");

    const finalLocationDetails = competitionInfo.cleanedLocationDetails || locationInfo.locationDetails;

    return {
      id,
      title,
      company,
      companyLogo,
      location: locationInfo.location,
      locationDetails: finalLocationDetails,
      roleCategory: roleInfo.category,
      seniority: seniorityInfo.level,
      salaryRange,
      workMode,
      applyType,
      isEasyApply,
      jobDescription: rawContent,
      requirementsSummary: requirements,
      responsibilitiesSummary: responsibilities,
      extractedSkills,
      linkedinUrl,
      postedDate: competitionInfo.parsedPostedDate || raw.postedDate || "",
      crawledAt: raw.crawledAt || raw.timestamp || new Date().toISOString(),
      experienceYearsRequired: seniorityInfo.experienceYears,
      applicantCountText: competitionInfo.applicantCountText,
      applicantCount: competitionInfo.applicantCount,
      competitionLevel: competitionInfo.competitionLevel,
      isPromoted: competitionInfo.isPromoted,
      responsesManagedOffLinkedIn: competitionInfo.responsesManagedOffLinkedIn,
      isActivelyReviewing: competitionInfo.isActivelyReviewing,
      rawContent,
      rawBadges,
      dataSource: raw.dataSource || "LINKEDIN_DOM",
      inferredFields: [
        ...(roleInfo.isInferred ? ["roleCategory"] : []),
        ...(seniorityInfo.isInferred ? ["seniority", "experienceYearsRequired"] : []),
        "workMode",
      ],
      missingFields,
    };
  }

  private extractLinkedInJobId(url: string): string | null {
    if (!url) return null;
    const viaPath = url.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/);
    if (viaPath) return viaPath[1];
    const viaQuery = url.match(/[?&]currentJobId=(\d{6,})/);
    return viaQuery ? viaQuery[1] : null;
  }

  private hashString(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  public mapBulkRawJobs(rawJobs: RawIngestedJob[], customConfig?: Partial<SystemConfig>): JobPosting[] {
    const mapped: JobPosting[] = [];
    for (const raw of rawJobs) {
      try {
        mapped.push(this.mapRawToJobPosting(raw, customConfig));
      } catch (err) {
        if (err instanceof IngestError) {
          console.warn(`[ingest] Bỏ qua 1 bản ghi: ${err.message}`);
          continue;
        }
        throw err;
      }
    }
    return mapped;
  }

  private resolveJobTitle(titleInput?: string, rawContent?: string, pageTitle?: string): string {
    if (titleInput && titleInput.trim().length > 3 && !titleInput.includes("LinkedIn")) {
      return titleInput.trim();
    }
    if (pageTitle && pageTitle.trim().length > 3) {
      const clean = pageTitle.split("|")[0].split("-")[0].trim();
      if (clean.length > 3 && !clean.includes("LinkedIn")) return clean;
    }
    const fullText = (rawContent || "").substring(0, 300);
    const titleMatch = fullText.match(/(Senior|Lead|Junior|Principal|Middle)?\s*(IT Business Analyst|Business Analyst|Data Analyst|Product Business Analyst|Product Owner|BI Specialist|IT BA|Data Engineer|ERP Consultant)/i);
    if (titleMatch) return titleMatch[0].trim();
    const lines = (rawContent || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 5);
    if (lines.length > 0 && lines[0].length < 80) return lines[0];
    throw new IngestError("MISSING_TITLE", "Không đọc được tiêu đề công việc.", ["title"]);
  }

  private resolveCompany(companyInput?: string, rawContent?: string): string {
    if (companyInput && companyInput.trim().length > 1 && !companyInput.includes("LinkedIn")) {
      return companyInput.trim();
    }
    const fullText = (rawContent || "").substring(0, 300);
    const compMatch = fullText.match(/^([A-Za-z0-9\s&.,-]{2,40})\s+(tuyển dụng|tuyển|cần tuyển|is hiring|looking for)/i);
    if (compMatch) return compMatch[1].trim();
    const lines = (rawContent || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
    if (lines.length > 1 && lines[1].length < 60) return lines[1];
    throw new IngestError("MISSING_COMPANY", "Không đọc được tên công ty.", ["company"]);
  }

  private classifyLocation(
    locationInput?: string,
    rawContent?: string,
    badges: string[] = [],
    cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { location: WorkLocation; locationDetails: string; inferred: boolean } {
    const combined = `${locationInput || ""} ${badges.join(" ")} ${(rawContent || "").substring(0, 1000)}`.toLowerCase();
    for (const rule of cfg.locations) {
      for (const kw of rule.keywords) {
        if (combined.includes(kw.toLowerCase())) {
          return {
            location: rule.location,
            locationDetails: locationInput && locationInput.length > 3 ? locationInput : rule.defaultDetails,
            inferred: !(locationInput && locationInput.length > 3),
          };
        }
      }
    }
    return {
      location: cfg.defaultLocation,
      locationDetails: locationInput && locationInput.length > 3 ? locationInput : "Không rõ địa điểm",
      inferred: true,
    };
  }

  /**
   * Phân loại nhóm vai trò. `isInferred` cho biết kết quả có phải giá trị mặc định
   * hay không, để chiều "liên quan vai trò" lúc chấm điểm không tin tưởng mù quáng.
   */
  private classifyRoleCategory(
    title: string,
    rawContent: string,
    cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { category: JobRoleCategory; isInferred: boolean } {
    const result = classifyRole(title, rawContent, cfg);
    if (result) {
      return { category: result.category, isInferred: !result.hasTitleSignal };
    }
    return { category: "BUSINESS_ANALYST", isInferred: true };
  }

  /**
   * Phân loại cấp bậc. Mặc định cũ trả về SENIOR/4 năm khi không đoán được — trùng khớp
   * chính xác hồ sơ ứng viên nên tự động cho điểm cấp bậc tối đa. Nay mặc định là MIDDLE
   * và luôn được ghi nhận vào inferredFields.
   */
  private classifySeniority(
    title: string,
    rawContent: string,
    cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { level: SeniorityLevel; experienceYears: number; isInferred: boolean } {
    const result = classifySeniorityFromText(title, rawContent, cfg);
    if (result) {
      return {
        level: result.level,
        experienceYears: result.experienceYears,
        isInferred: !result.fromTitle,
      };
    }
    return { level: "MIDDLE", experienceYears: 2.5, isInferred: true };
  }

  public parseSalary(
    salaryInput?: string,
    rawContent?: string,
    badges: string[] = [],
    title: string = "",
    _cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { min?: number; max?: number; currency: "VND" | "USD"; display: string; isNegotiable?: boolean } | undefined {
    return SalaryExtractor.extract(salaryInput, rawContent, badges, title);
  }

  private classifyWorkMode(modeInput?: string, rawContent?: string, badges: string[] = []): WorkMode {
    if (modeInput === "ON_SITE" || modeInput === "HYBRID" || modeInput === "REMOTE") return modeInput;
    const text = `${badges.join(" ")} ${(rawContent || "").substring(0, 500)}`.toLowerCase();
    if (text.includes("remote") || text.includes("từ xa")) return "REMOTE";
    if (text.includes("on-site") || text.includes("onsite") || text.includes("tại văn phòng")) return "ON_SITE";
    return "HYBRID";
  }

  private classifyApplyType(
    rawApplyType?: string,
    badges: string[] = [],
    rawContent: string = "",
    explicitIsEasyApply?: boolean
  ): { applyType: ApplyType; isEasyApply: boolean } {
    if (explicitIsEasyApply === true || rawApplyType === "EASY_APPLY") {
      return { applyType: "EASY_APPLY", isEasyApply: true };
    }
    const combined = `${badges.join(" ")} ${rawContent.substring(0, 800)}`.toLowerCase();
    if (combined.includes("easy apply") || combined.includes("easyapply") || combined.includes("ứng tuyển dễ dàng")) {
      return { applyType: "EASY_APPLY", isEasyApply: true };
    }
    return { applyType: "EXTERNAL_APPLY", isEasyApply: false };
  }

  private extractSummaries(rawContent: string): { responsibilities: string[]; requirements: string[] } {
    const lines = rawContent
      .split("\n")
      .map((l) => l.trim().replace(/^[-*•+•\d.]\s*/, ""))
      .filter((l) => l.length > 15 && !l.toLowerCase().includes("linkedin"));

    if (lines.length >= 6) {
      return { responsibilities: lines.slice(0, 4), requirements: lines.slice(4, 8) };
    }
    return { responsibilities: lines.slice(0, 3), requirements: lines.slice(3, 6) };
  }
}

export const jobMappingService = new JobMappingService();
