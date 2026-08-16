import { JobRoleCategory, SeniorityLevel, WorkLocation } from "../dtos/job.dto";

/**
 * Cấu hình tham số hóa toàn diện cho hệ thống
 * Cho phép tùy biến động theo ngữ cảnh mà không bị phụ thuộc vào giá trị cố định (hardcoded).
 */

export interface LocationRule {
  location: WorkLocation;
  defaultDetails: string;
  keywords: string[];
}

export interface RoleCategoryRule {
  category: JobRoleCategory;
  titleKeywords: string[];
  contentKeywords: string[];
}

export interface SeniorityRule {
  level: SeniorityLevel;
  keywords: string[];
  defaultExperienceYears: number;
}

export interface ScoringWeightsConfig {
  coreMustHaveWeight: number;
  coreGoodToHaveWeight: number;
  secondaryMustHaveWeight: number;
  secondaryGoodToHaveWeight: number;
  minProficiencyFloor: number;
}

export interface SystemConfig {
  defaultCurrency: "VND" | "USD";
  usdToVndExchangeRate: number;
  defaultLocation: WorkLocation;
  locations: LocationRule[];
  roleCategories: RoleCategoryRule[];
  seniorities: SeniorityRule[];
  scoringWeights: ScoringWeightsConfig;
}

/**
 * Cấu hình mặc định của hệ thống
 */
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  defaultCurrency: "VND",
  usdToVndExchangeRate: 25400,
  defaultLocation: "HO_CHI_MINH",
  locations: [
    {
      location: "DONG_NAI",
      defaultDetails: "Đồng Nai / KCN Vùng Đông Nam Bộ",
      keywords: [
        "đồng nai",
        "dong nai",
        "biên hòa",
        "bien hoa",
        "kcn amata",
        "amata",
        "long thành",
        "long thanh",
        "nhơn trạch",
        "nhon trach",
        "sông mây",
        "song may",
        "bàu xéo",
        "hố nai",
      ],
    },
    {
      location: "HO_CHI_MINH",
      defaultDetails: "TP. Hồ Chí Minh",
      keywords: [
        "hồ chí minh",
        "ho chi minh",
        "tp.hcm",
        "tphcm",
        "hcm",
        "sài gòn",
        "saigon",
        "quận 1",
        "quận 2",
        "quận 7",
        "thủ đức",
        "bình thạnh",
        "tân bình",
        "shtp",
        "khu công nghệ cao",
      ],
    },
    {
      location: "REMOTE",
      defaultDetails: "Làm việc từ xa (Remote)",
      keywords: ["remote", "từ xa", "work from home", "wfh", "toàn thời gian từ xa"],
    },
    {
      location: "HYBRID",
      defaultDetails: "Linh hoạt (Hybrid)",
      keywords: ["hybrid", "linh hoạt", "kết hợp văn phòng và từ xa"],
    },
  ],
  roleCategories: [
    {
      category: "HYBRID_BA_DA",
      titleKeywords: ["hybrid", "product data", "business & data", "ba & da"],
      contentKeywords: ["business analyst and data", "vừa phân tích nghiệp vụ vừa dữ liệu"],
    },
    {
      category: "DATA_ANALYST",
      titleKeywords: ["data analyst", "data analytics", "bi analyst", "bi specialist", "dữ liệu", "analytics"],
      contentKeywords: ["power bi", "tableau", "data warehouse", "sql querying", "phân tích dữ liệu"],
    },
    {
      category: "BUSINESS_ANALYST",
      titleKeywords: ["business analyst", "it ba", "product ba", "nghiệp vụ", "ba", "system analyst"],
      contentKeywords: ["brd", "srs", "user story", "bpmn", "phân tích nghiệp vụ"],
    },
  ],
  seniorities: [
    {
      level: "LEAD_MANAGER",
      keywords: ["lead", "manager", "trưởng nhóm", "trưởng phòng", "head", "principal", "director"],
      defaultExperienceYears: 5,
    },
    {
      level: "SENIOR",
      keywords: ["senior", "chuyên viên cao cấp", "chính", "sr.", "sr ", "chủ chốt"],
      defaultExperienceYears: 4,
    },
    {
      level: "MIDDLE",
      keywords: ["middle", "chuyên viên", "mid", "kinh nghiệm 2-3 năm"],
      defaultExperienceYears: 2.5,
    },
    {
      level: "JUNIOR",
      keywords: ["junior", "fresher", "mới tốt nghiệp", "dưới 2 năm"],
      defaultExperienceYears: 1,
    },
    {
      level: "INTERN",
      keywords: ["intern", "thực tập", "thực tập sinh", "trainee"],
      defaultExperienceYears: 0,
    },
  ],
  scoringWeights: {
    coreMustHaveWeight: 10,
    coreGoodToHaveWeight: 5,
    secondaryMustHaveWeight: 6,
    secondaryGoodToHaveWeight: 3,
    minProficiencyFloor: 0.6,
  },
};
