import { JobPosting } from "./job.dto";
import { JobMatchScoreResult } from "./scoring.dto";

/**
 * Các type dùng chung giữa component client và service phía server.
 *
 * Lý do tách khỏi job-service.ts / cv-matcher-service.ts: sau khi repository
 * chuyển sang PostgreSQL, chuỗi phụ thuộc trở thành
 *   job-service -> job-repository -> db/client -> pg + ssh2
 * Chỉ cần một component client import nhầm VALUE (thay vì `import type`) là cả
 * `pg` và `ssh2` bị kéo vào client bundle và build vỡ với lỗi khó hiểu
 * ("Module not found: Can't resolve 'fs'"). Giữ type ở DTO thuần khiến điều đó
 * không thể xảy ra.
 */

export interface JobWithScore extends JobPosting {
  scoreResult: JobMatchScoreResult;
}

export interface CareerGrowthJob {
  job: JobPosting;
  matchScore: number;
  readinessScore: number;
  salaryUpside: string;
  bridgeSkills: string[];
  growthPotentialReasons: string[];
  progressionType: "UPGRADE_SENIORITY" | "CROSS_EXPANSION_HYBRID" | "HIGH_SALARY_LEAP";
}

export interface CvMatchingAnalysisResult {
  extractedProfile: {
    fullName: string;
    targetRole: string;
    detectedSeniority: string;
    estimatedYears: number;
    skillsCount: number;
    topSkills: string[];
  };
  bestFitJobs: JobWithScore[];
  growthOpportunities: CareerGrowthJob[];
  careerRoadmapTips: string[];
}
