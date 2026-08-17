import { DEFAULT_SYSTEM_CONFIG, SystemConfig } from "../constants/app-config";
import { JobRoleCategory, SeniorityLevel } from "../dtos/job.dto";
import { matchAnyKeyword, matchKeyword } from "./text-matching";

/**
 * Bộ phân loại vai trò và cấp bậc dùng chung cho cả hai giai đoạn:
 * - Lúc nạp dữ liệu (job-mapping-service) để ghi vào DB
 * - Lúc chấm điểm (scoring-service) để kiểm chứng lại giá trị đã lưu
 *
 * Việc dùng chung là cần thiết vì các bản ghi đã nằm trong DB được phân loại
 * bằng logic cũ; chấm điểm phải tự kiểm chứng thay vì tin tuyệt đối vào cột đã lưu.
 */

export interface SeniorityClassification {
  level: SeniorityLevel;
  experienceYears: number;
  /** true khi tín hiệu đến từ tiêu đề (đáng tin), false khi chỉ suy từ mô tả */
  fromTitle: boolean;
}

/**
 * Phân loại cấp bậc từ tiêu đề, sau đó mới tới phần đầu mô tả.
 *
 * Ưu tiên tiêu đề là điểm mấu chốt: quét lẫn mô tả khiến những cụm như
 * "leading provider" hay "leadership skills" đẩy job thành LEAD_MANAGER.
 * Trả về null khi không có tín hiệu nào — người gọi tự quyết định cách xử lý,
 * thay vì mặc định SENIOR (trùng khớp hồ sơ ứng viên nên tự động được điểm tối đa).
 */
export function classifySeniority(
  title: string,
  rawContent = "",
  cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
): SeniorityClassification | null {
  const titleLower = (title || "").toLowerCase();

  for (const rule of cfg.seniorities) {
    if (matchAnyKeyword(titleLower, rule.keywords)) {
      return {
        level: rule.level,
        experienceYears: rule.defaultExperienceYears,
        fromTitle: true,
      };
    }
  }

  // Tiêu đề không nói gì: thử phần đầu mô tả, nhưng đánh dấu là kém tin cậy
  const contentLower = (rawContent || "").substring(0, 300).toLowerCase();
  if (contentLower) {
    for (const rule of cfg.seniorities) {
      if (matchAnyKeyword(contentLower, rule.keywords)) {
        return {
          level: rule.level,
          experienceYears: rule.defaultExperienceYears,
          fromTitle: false,
        };
      }
    }
  }

  return null;
}

export interface RoleClassification {
  category: JobRoleCategory;
  /** true khi chính tiêu đề xác nhận đây là vai trò BA/DA */
  hasTitleSignal: boolean;
}

/**
 * Phân loại nhóm vai trò. Trả về null khi không có căn cứ nào,
 * để người gọi phân biệt "đoán được" với "không đoán được".
 */
export function classifyRole(
  title: string,
  rawContent = "",
  cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
): RoleClassification | null {
  const titleLower = (title || "").toLowerCase();
  const contentLower = (rawContent || "").substring(0, 600).toLowerCase();

  for (const rule of cfg.roleCategories) {
    if (matchAnyKeyword(titleLower, rule.titleKeywords)) {
      return { category: rule.category, hasTitleSignal: true };
    }
  }

  for (const rule of cfg.roleCategories) {
    if (matchAnyKeyword(contentLower, rule.contentKeywords)) {
      return { category: rule.category, hasTitleSignal: false };
    }
  }

  return null;
}

/**
 * Nhận diện tiêu đề thuộc ngành nghề khác hẳn BA/DA.
 *
 * Cần thiết vì cột roleCategory mặc định về BUSINESS_ANALYST khi không phân loại được,
 * khiến những tin như "Graphic Designer" hay "Interpreter" vẫn được chấm như job BA.
 */
export function isUnrelatedRole(
  title: string,
  cfg: SystemConfig = DEFAULT_SYSTEM_CONFIG
): boolean {
  const titleLower = (title || "").toLowerCase();
  if (!titleLower) return false;

  // Tiêu đề đã tự khẳng định là BA/DA thì không xét tiếp
  for (const rule of cfg.roleCategories) {
    if (matchAnyKeyword(titleLower, rule.titleKeywords)) return false;
  }

  return cfg.unrelatedRoleMarkers.some((marker) => matchKeyword(titleLower, marker));
}

/** Thứ tự cấp bậc từ thấp đến cao, dùng để tính khoảng cách giữa hai cấp */
export const SENIORITY_ORDER: SeniorityLevel[] = [
  "INTERN",
  "FRESHER",
  "JUNIOR",
  "MIDDLE",
  "SENIOR",
  "LEAD_MANAGER",
];

export function seniorityRank(level: SeniorityLevel): number {
  const index = SENIORITY_ORDER.indexOf(level);
  return index === -1 ? SENIORITY_ORDER.indexOf("MIDDLE") : index;
}
