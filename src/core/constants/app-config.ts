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

/**
 * Ngân sách điểm của từng chiều chấm. Tổng bốn chiều phải bằng 100.
 * Chỉ giữ những chiều thực sự biến thiên giữa các tin tuyển dụng:
 * chứng chỉ là thuộc tính của ứng viên (hằng số với mọi job) nên không còn được tính điểm,
 * địa điểm chuyển thành hệ số nhân vì gần như mọi job đều đạt điểm tối đa.
 */
export interface ScoringWeightsConfig {
  /** Độ phủ kỹ năng mà JD yêu cầu — tín hiệu chính */
  skillCoverageMax: number;
  /** Mức độ vai trò của job trùng với định hướng nghề nghiệp của ứng viên */
  roleRelevanceMax: number;
  /** Mức độ khớp cấp bậc, có phạt cả thừa lẫn thiếu */
  seniorityFitMax: number;
  /** Mức độ đáng nộp đơn xét theo cạnh tranh: ít ứng viên, nhà tuyển dụng đang review */
  opportunityMax: number;

  /** Trọng số tương đối của kỹ năng GOOD_TO_HAVE so với MUST_HAVE khi tính độ phủ */
  goodToHaveWeightRatio: number;
  /** Tỷ lệ điểm bị trừ cho mỗi kỹ năng MUST_HAVE còn thiếu */
  missingMustHavePenalty: number;
  /** Số lần tối đa áp dụng khoản phạt trên (tránh triệt tiêu hoàn toàn) */
  maxMissingMustHavePenalties: number;

  /** Hệ số nhân khi địa điểm không nằm trong vùng ưu tiên và job bắt buộc lên văn phòng */
  locationMismatchMultiplier: number;
  /** Hệ số nhân khi địa điểm giáp ranh vùng ưu tiên */
  locationAdjacentMultiplier: number;

  /**
   * Tổng trọng số yêu cầu cần có để tin tưởng hoàn toàn vào tỷ lệ độ phủ.
   * Dưới ngưỡng này, điểm độ phủ bị chiết khấu theo tỷ lệ vì mẫu quá nhỏ:
   * khớp 1/1 kỹ năng không phải bằng chứng tương đương khớp 10/10.
   */
  fullEvidenceWeight: number;
  /** Số kỹ năng trích được tối thiểu để coi JD là đủ dữ liệu chấm điểm */
  minSkillsForFullEvidence: number;
  /** Độ dài JD tối thiểu để coi là đủ dữ liệu */
  minJdLengthForFullEvidence: number;
}

/**
 * Ngưỡng phân hạng điểm — nguồn chân lý duy nhất.
 * Trước đây ba nơi tự khai báo lại bộ số này (scoring service, badge, breakdown card)
 * nên chúng có thể lệch nhau mà không ai phát hiện.
 */
export const SCORE_TIER_THRESHOLDS = {
  PERFECT_MATCH: 85,
  HIGH_MATCH: 70,
  MODERATE_MATCH: 50,
} as const;

export interface CrawlerDelayConfig {
  minCardDelayMs: number;
  maxCardDelayMs: number;
  minPageDelayMs: number;
  maxPageDelayMs: number;
}

export interface SystemConfig {
  defaultCurrency: "VND" | "USD";
  usdToVndExchangeRate: number;
  defaultLocation: WorkLocation;
  locations: LocationRule[];
  roleCategories: RoleCategoryRule[];
  seniorities: SeniorityRule[];
  /** Từ khóa tiêu đề cho thấy job không thuộc mảng BA/DA */
  unrelatedRoleMarkers: string[];
  scoringWeights: ScoringWeightsConfig;
  crawlerDelay: CrawlerDelayConfig;
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
  // Thứ tự quyết định kết quả: luật khớp đầu tiên sẽ thắng.
  // Cấp bậc thấp phải đứng trước cấp bậc cao, nếu không "Business Analyst, Internship"
  // sẽ bị gán LEAD_MANAGER chỉ vì phần mô tả có chữ "lead".
  seniorities: [
    {
      level: "INTERN",
      keywords: ["intern", "internship", "thực tập sinh", "thực tập", "trainee"],
      defaultExperienceYears: 0,
    },
    {
      level: "FRESHER",
      keywords: ["fresher", "mới tốt nghiệp", "sinh viên mới ra trường", "entry level", "entry-level"],
      defaultExperienceYears: 0.5,
    },
    {
      level: "JUNIOR",
      keywords: ["junior", "jr.", "dưới 2 năm"],
      defaultExperienceYears: 1,
    },
    {
      level: "LEAD_MANAGER",
      keywords: [
        "lead",
        "leader",
        "manager",
        "head of",
        "principal",
        "director",
        "trưởng nhóm",
        "trưởng phòng",
        "giám đốc",
      ],
      defaultExperienceYears: 5,
    },
    {
      level: "SENIOR",
      // "chính" đã bị loại: nó khớp cả "tài chính", "chính sách", "chính xác".
      keywords: ["senior", "sr.", "chuyên viên cao cấp", "chuyên viên chính", "chủ chốt"],
      defaultExperienceYears: 4,
    },
    {
      level: "MIDDLE",
      keywords: ["middle", "mid", "chuyên viên", "kinh nghiệm 2-3 năm"],
      defaultExperienceYears: 2.5,
    },
  ],
  // Dấu hiệu trong tiêu đề cho thấy job thuộc ngành nghề khác hẳn BA/DA.
  // Cần thiết vì classifyRoleCategory mặc định trả về BUSINESS_ANALYST khi không đoán được,
  // khiến Graphic Designer hay Interpreter vẫn được chấm như một job BA.
  unrelatedRoleMarkers: [
    "graphic designer",
    "ui designer",
    "ux designer",
    "interpreter",
    "translator",
    "biên dịch",
    "phiên dịch",
    "sales consultant",
    "sales executive",
    "sales representative",
    "account executive",
    "telesales",
    "nhân viên kinh doanh",
    "business development",
    "hr",
    "human resource",
    "nhân sự",
    "recruiter",
    "tuyển dụng",
    "accountant",
    "kế toán",
    "software engineer",
    "engineering manager",
    "backend engineer",
    "frontend engineer",
    "fullstack",
    "devops",
    "qa engineer",
    "tester",
    "marketing executive",
    "content writer",
    "copywriter",
    "designer",
    "architect",
    "nurse",
    "teacher",
    "giáo viên",
    "receptionist",
    "lễ tân",
    "driver",
    "tài xế",
    "tour operator",
  ],
  scoringWeights: {
    // Tổng bốn chiều = 100
    skillCoverageMax: 55,
    roleRelevanceMax: 15,
    seniorityFitMax: 15,
    opportunityMax: 15,

    goodToHaveWeightRatio: 0.4,
    missingMustHavePenalty: 0.15,
    maxMissingMustHavePenalties: 2,

    locationMismatchMultiplier: 0.85,
    locationAdjacentMultiplier: 0.95,

    // Xấp xỉ tổng trọng số của 3-4 kỹ năng bắt buộc điển hình
    fullEvidenceWeight: 25,
    minSkillsForFullEvidence: 3,
    minJdLengthForFullEvidence: 1200,
  },
  crawlerDelay: {
    minCardDelayMs: 1800,
    maxCardDelayMs: 3800,
    minPageDelayMs: 3500,
    maxPageDelayMs: 6500,
  },
};
