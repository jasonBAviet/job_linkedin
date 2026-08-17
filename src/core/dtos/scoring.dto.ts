import { SkillRequirement } from "./job.dto";

export interface SkillMatchDetail {
  skillName: string;
  category: string;
  importance: "MUST_HAVE" | "GOOD_TO_HAVE";
  isMatched: boolean;
  candidateProficiency?: number;
  weight: number;
}

export interface ScoreBreakdown {
  /** Độ phủ kỹ năng JD yêu cầu (mặc định tối đa 55) */
  skillCoverageScore: number;
  /** Vai trò job khớp định hướng nghề nghiệp (mặc định tối đa 15) */
  roleRelevanceScore: number;
  /** Khớp cấp bậc, phạt cả thừa lẫn thiếu (mặc định tối đa 15) */
  seniorityFitScore: number;
  /** Mức độ đáng nộp đơn theo cạnh tranh (mặc định tối đa 15) */
  opportunityScore: number;
  /** Hệ số nhân theo địa điểm, 0.85 - 1.0 */
  locationMultiplier: number;
  totalScore: number; // 0 - 100
}

/**
 * Mức độ tin cậy của dữ liệu JD dùng để chấm điểm.
 * Tách khỏi điểm số để người dùng phân biệt "job không phù hợp"
 * với "JD viết quá sơ sài nên không đủ căn cứ chấm".
 */
export type ScoreEvidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ScoreEvidence {
  level: ScoreEvidenceLevel;
  /** Số kỹ năng trích được từ JD */
  extractedSkillCount: number;
  /** Các trường bị suy đoán thay vì lấy trực tiếp từ nguồn */
  inferredFields: string[];
  /** Diễn giải ngắn cho người dùng */
  reason?: string;
}

export interface RadarMetric {
  subject: string;
  required: number; // 0 - 100
  candidate: number; // 0 - 100
  fullMark: number;
}

export interface GapAnalysisResult {
  matchedSkills: string[];
  missingMustHaveSkills: SkillRequirement[];
  missingGoodToHaveSkills: SkillRequirement[];
  strongestAreas: string[];
  improvementSuggestions: string[];
  interviewPrepTips: string[];
}

export interface JobMatchScoreResult {
  jobId: string;
  totalScore: number; // 0 - 100
  scoreTier: "PERFECT_MATCH" | "HIGH_MATCH" | "MODERATE_MATCH" | "LOW_MATCH";
  breakdown: ScoreBreakdown;
  /**
   * Tỷ lệ đáp ứng yêu cầu kỹ năng của JD (0 - 1), chưa pha trộn với các chiều khác.
   * Giữ riêng để vẫn sắp xếp được theo độ khớp thuần khi cần.
   */
  coverageRatio: number | null;
  evidence: ScoreEvidence;
  gapAnalysis: GapAnalysisResult;
  skillDetails: SkillMatchDetail[];
}
