import { JobPosting, JobRoleCategory, SeniorityLevel, WorkLocation } from "../dtos/job.dto";
import { scoringService } from "./scoring-service";
import { getCompanyLogoUrl } from "../utils/logo-resolver";
import { DEFAULT_SYSTEM_CONFIG, SystemConfig } from "../constants/app-config";

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
  workMode?: "ON_SITE" | "HYBRID" | "REMOTE";
  postedDate?: string;
}

export class JobMappingService {
  private config: SystemConfig;

  constructor(customConfig?: Partial<SystemConfig>) {
    this.config = { ...DEFAULT_SYSTEM_CONFIG, ...customConfig };
  }

  /**
   * Cập nhật cấu hình động cho Mapping Service
   */
  public updateConfig(newConfig: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Ánh xạ toàn bộ dữ liệu thô (Raw Ingestion) thành đối tượng JobPosting chuẩn hóa
   */
  public mapRawToJobPosting(raw: RawIngestedJob, customConfig?: Partial<SystemConfig>): JobPosting {
    const activeConfig = customConfig ? { ...this.config, ...customConfig } : this.config;
    const rawContent = raw.rawContent || raw.jobDescription || raw.description || "";
    const rawBadges = raw.rawBadges || [];

    // 1. Ánh xạ Tiêu đề công việc
    const title = this.resolveJobTitle(raw.rawTitle || raw.title, rawContent, raw.pageTitle);

    // 2. Ánh xạ Tên công ty
    const company = this.resolveCompany(raw.rawCompany || raw.company, rawContent);

    // 3. Phân loại Địa điểm động
    const locationInfo = this.classifyLocation(raw.rawLocation || raw.locationDetails, rawContent, rawBadges, activeConfig);

    // 4. Phân loại Vai trò động
    const roleCategory = this.classifyRoleCategory(title, rawContent, activeConfig);

    // 5. Phân loại Cấp bậc động
    const seniorityInfo = this.classifySeniority(title, rawContent, activeConfig);

    // 6. Chuẩn hóa Mức lương động
    const salaryRange = this.parseSalary(raw.rawSalaryText || raw.salaryText, rawContent, rawBadges, activeConfig);

    // 7. Xác định Hình thức làm việc
    const workMode = this.classifyWorkMode(raw.workMode, rawContent, rawBadges);

    // 8. Trích xuất Kỹ năng
    const fullTextForSkills = `${title} ${company} ${rawBadges.join(" ")} ${rawContent}`;
    const extractedSkills = scoringService.extractSkillsFromText(fullTextForSkills);

    // 9. Tách tóm tắt Trách nhiệm & Yêu cầu
    const { responsibilities, requirements } = this.extractSummaries(rawContent);

    // 10. Phân giải Logo thương hiệu
    const companyLogo = getCompanyLogoUrl(company, raw.companyLogo);

    const id = raw.id || `job-ingested-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const linkedinUrl = raw.linkedinUrl || raw.url || raw.pageUrl || "https://www.linkedin.com/jobs";
    const postedDate = raw.postedDate || new Date().toISOString().split("T")[0];

    return {
      id,
      title,
      company,
      companyLogo,
      location: locationInfo.location,
      locationDetails: locationInfo.locationDetails,
      roleCategory,
      seniority: seniorityInfo.level,
      salaryRange,
      workMode,
      jobDescription: rawContent.length > 20 ? rawContent : `Tuyển dụng ${title} tại ${company}. Chi tiết xem tại ${linkedinUrl}`,
      requirementsSummary: requirements.length > 0 ? requirements : ["Có kinh nghiệm thực tế phù hợp với yêu cầu vị trí."],
      responsibilitiesSummary: responsibilities.length > 0 ? responsibilities : ["Tham gia thực hiện các nhiệm vụ phân tích theo kế hoạch dự án."],
      extractedSkills: extractedSkills.length > 0 ? extractedSkills : [
        { name: "Requirements Engineering", category: "CORE", importance: "MUST_HAVE" },
        { name: "SQL (Advanced Querying)", category: "CORE", importance: "MUST_HAVE" },
      ],
      linkedinUrl,
      postedDate,
      experienceYearsRequired: seniorityInfo.experienceYears,
      rawContent,
      rawBadges,
    };
  }

  /**
   * Ánh xạ danh sách việc làm thô
   */
  public mapBulkRawJobs(rawJobs: RawIngestedJob[], customConfig?: Partial<SystemConfig>): JobPosting[] {
    return rawJobs.map((raw) => this.mapRawToJobPosting(raw, customConfig));
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
    if (titleMatch) {
      return titleMatch[0].trim();
    }
    const lines = (rawContent || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 5);
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.length < 80) return firstLine;
    }
    return "Senior Business / Data Analyst";
  }

  private resolveCompany(companyInput?: string, rawContent?: string): string {
    if (companyInput && companyInput.trim().length > 1 && !companyInput.includes("LinkedIn")) {
      return companyInput.trim();
    }
    const fullText = (rawContent || "").substring(0, 300);
    const compMatch = fullText.match(/^([A-Za-z0-9\s&.,-]{2,40})\s+(tuyển dụng|tuyển|cần tuyển|is hiring|looking for)/i);
    if (compMatch) {
      return compMatch[1].trim();
    }
    const lines = (rawContent || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
    if (lines.length > 1 && lines[1].length < 60) {
      return lines[1];
    }
    return "Doanh nghiệp tuyển dụng";
  }

  private classifyLocation(
    locationInput?: string,
    rawContent?: string,
    badges: string[] = [],
    cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { location: WorkLocation; locationDetails: string } {
    const combined = `${locationInput || ""} ${badges.join(" ")} ${(rawContent || "").substring(0, 1000)}`.toLowerCase();

    for (const rule of cfg.locations) {
      for (const kw of rule.keywords) {
        if (combined.includes(kw.toLowerCase())) {
          return {
            location: rule.location,
            locationDetails: locationInput && locationInput.length > 3 ? locationInput : rule.defaultDetails,
          };
        }
      }
    }

    return {
      location: cfg.defaultLocation,
      locationDetails: locationInput && locationInput.length > 3 ? locationInput : "Khu vực tuyển dụng",
    };
  }

  private classifyRoleCategory(title: string, rawContent: string, cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG): JobRoleCategory {
    const titleLower = title.toLowerCase();
    const contentLower = rawContent.substring(0, 600).toLowerCase();

    for (const rule of cfg.roleCategories) {
      const matchTitle = rule.titleKeywords.some((kw) => titleLower.includes(kw.toLowerCase()));
      const matchContent = rule.contentKeywords.some((kw) => contentLower.includes(kw.toLowerCase()));
      if (matchTitle || matchContent) {
        return rule.category;
      }
    }

    return "BUSINESS_ANALYST";
  }

  private classifySeniority(title: string, rawContent: string, cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG): { level: SeniorityLevel; experienceYears: number } {
    const combined = `${title} ${rawContent.substring(0, 300)}`.toLowerCase();

    for (const rule of cfg.seniorities) {
      for (const kw of rule.keywords) {
        if (combined.includes(kw.toLowerCase())) {
          return {
            level: rule.level,
            experienceYears: rule.defaultExperienceYears,
          };
        }
      }
    }

    return {
      level: "SENIOR",
      experienceYears: 4,
    };
  }

  private parseSalary(
    salaryInput?: string,
    rawContent?: string,
    badges: string[] = [],
    cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
  ): { min?: number; max?: number; currency: "VND" | "USD"; display: string; isNegotiable?: boolean } {
    const candidateText = salaryInput || badges.find((b) => b.includes("₫") || b.includes("$") || b.includes("Triệu") || b.includes("tháng")) || "";
    if (candidateText && candidateText.length > 2) {
      const isUSD = candidateText.includes("$") || candidateText.toUpperCase().includes("USD");
      return {
        currency: isUSD ? "USD" : "VND",
        display: candidateText,
        isNegotiable: true,
      };
    }

    const fullText = (rawContent || "").substring(0, 1500);
    const vnMatch = fullText.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*(tr|triệu|million)/i);
    if (vnMatch) {
      const min = parseInt(vnMatch[1], 10) * 1000000;
      const max = parseInt(vnMatch[2], 10) * 1000000;
      return {
        min,
        max,
        currency: "VND",
        display: `${vnMatch[1]} - ${vnMatch[2]} Triệu VNĐ`,
      };
    }

    return {
      currency: cfg.defaultCurrency,
      display: "Thỏa thuận theo năng lực",
      isNegotiable: true,
    };
  }

  private classifyWorkMode(modeInput?: string, rawContent?: string, badges: string[] = []): "ON_SITE" | "HYBRID" | "REMOTE" {
    if (modeInput === "ON_SITE" || modeInput === "HYBRID" || modeInput === "REMOTE") {
      return modeInput;
    }
    const text = `${badges.join(" ")} ${(rawContent || "").substring(0, 500)}`.toLowerCase();
    if (text.includes("remote") || text.includes("từ xa")) return "REMOTE";
    if (text.includes("on-site") || text.includes("onsite") || text.includes("tại văn phòng")) return "ON_SITE";
    return "HYBRID";
  }

  private extractSummaries(rawContent: string): { responsibilities: string[]; requirements: string[] } {
    const lines = rawContent
      .split("\n")
      .map((l) => l.trim().replace(/^[-*•+•\d.]\s*/, ""))
      .filter((l) => l.length > 15 && !l.toLowerCase().includes("linkedin") && !l.toLowerCase().includes("easy apply"));

    if (lines.length >= 6) {
      return {
        responsibilities: lines.slice(0, 4),
        requirements: lines.slice(4, 8),
      };
    }

    return {
      responsibilities: lines.slice(0, 3),
      requirements: lines.slice(3, 6),
    };
  }
}

export const jobMappingService = new JobMappingService();
