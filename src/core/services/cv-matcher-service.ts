import { JobPosting } from "../dtos/job.dto";
import { CandidateProfile, CandidateSkill } from "../dtos/profile.dto";
import { JobWithScore, jobService } from "./job-service";
import { scoringService } from "./scoring-service";
import { jobRepository } from "../repositories/job-repository";

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

export class CvMatcherService {
  /**
   * Phân tích CV và tìm kiếm việc làm khớp nhất + cơ hội mở rộng/nâng cấp sự nghiệp
   */
  public analyzeAndMatchCv(cvText: string): CvMatchingAnalysisResult {
    const textLower = cvText.toLowerCase();
    const extractedSkills = scoringService.extractSkillsFromText(cvText);

    // Phát hiện số năm kinh nghiệm
    let estimatedYears = 4;
    const yearMatch = textLower.match(/(\d+)\s*(năm|\+?\s*years?|yrs?)/);
    if (yearMatch && yearMatch[1]) {
      estimatedYears = Math.min(15, Math.max(1, parseInt(yearMatch[1], 10)));
    }

    // Phát hiện vai trò
    const isDA = textLower.includes("data") || textLower.includes("dữ liệu") || textLower.includes("sql");
    const isBA = textLower.includes("business") || textLower.includes("nghiệp vụ") || textLower.includes("bpmn");
    const targetRole = isDA && isBA ? "HYBRID_BA_DA" : isDA ? "DATA_ANALYST" : "BUSINESS_ANALYST";

    // Phát hiện cấp bậc
    const detectedSeniority =
      estimatedYears >= 5 || textLower.includes("lead") || textLower.includes("manager")
        ? "LEAD_MANAGER"
        : estimatedYears >= 3
        ? "SENIOR"
        : "MIDDLE";

    // Xây dựng Profile ảo từ CV
    const candidateSkills: CandidateSkill[] = extractedSkills.map((s) => ({
      name: s.name,
      category: s.category as any,
      proficiencyLevel: 4,
      yearsOfExperience: Math.min(estimatedYears, 3),
    }));

    const mockProfile: CandidateProfile = {
      id: `cv-candidate-${Date.now()}`,
      fullName: "Ứng Viên Săn Việc",
      targetRole,
      currentSeniority: detectedSeniority,
      yearsOfTotalExperience: estimatedYears,
      skills: candidateSkills,
      preferredLocations: ["HO_CHI_MINH", "DONG_NAI"],
      expectedSalaryVND: 40000000,
      rawResumeText: cvText,
      lastUpdated: new Date().toISOString(),
    };

    // Lấy tất cả việc làm từ repository
    const allJobs = jobRepository.getAllJobs();

    // 1. Nhóm Việc Làm Khớp Nhất (Best Fit)
    const bestFitJobs: JobWithScore[] = allJobs
      .map((job) => {
        const scoreResult = scoringService.calculateMatchScore(mockProfile, job);
        return { ...job, scoreResult };
      })
      .sort((a, b) => (b.scoreResult?.totalScore || 0) - (a.scoreResult?.totalScore || 0));

    // 2. Nhóm Tiềm Năng Mở Rộng & Nâng Cấp Sự Nghiệp (Growth & Progression)
    const growthOpportunities: CareerGrowthJob[] = allJobs
      .filter((j) => j.seniority === "LEAD_MANAGER" || (j.salaryRange?.min && j.salaryRange.min >= 48000000))
      .map((job) => {
        const scoreResult = scoringService.calculateMatchScore(mockProfile, job);
        const score = scoreResult.totalScore;
        const missingMustHave = scoreResult.gapAnalysis?.missingMustHaveSkills.map((s) => s.name) || [];
        const missingGood = scoreResult.gapAnalysis?.missingGoodToHaveSkills.map((s) => s.name) || [];
        const bridgeSkills = [...missingMustHave, ...missingGood].slice(0, 4);

        let progressionType: CareerGrowthJob["progressionType"] = "UPGRADE_SENIORITY";
        if (job.roleCategory === "HYBRID_BA_DA" && targetRole !== "HYBRID_BA_DA") {
          progressionType = "CROSS_EXPANSION_HYBRID";
        } else if ((job.salaryRange?.min || 0) >= 50000000) {
          progressionType = "HIGH_SALARY_LEAP";
        }

        const reasons: string[] = [];
        if (job.seniority === "LEAD_MANAGER") {
          reasons.push("Vị trí Quản lý / Techlead dẫn dắt đội ngũ dự án");
        }
        if (job.salaryRange?.display) {
          reasons.push(`Gói thu nhập hấp dẫn: ${job.salaryRange.display}`);
        }
        if (job.location === "DONG_NAI") {
          reasons.push("Môi trường Chuỗi cung ứng / Smart Factory công nghiệp phụ trợ");
        }

        return {
          job,
          matchScore: score,
          readinessScore: Math.min(95, Math.max(50, score + 10)),
          salaryUpside: job.salaryRange?.display || "Thương lượng cấp cao",
          bridgeSkills: bridgeSkills.length > 0 ? bridgeSkills : ["System Architecture", "Leadership"],
          growthPotentialReasons: reasons,
          progressionType,
        };
      })
      .sort((a, b) => b.readinessScore - a.readinessScore);

    const careerRoadmapTips = [
      "Tập trung hoàn thiện các kỹ năng cầu nối (Bridge Skills) còn thiếu để nâng cao tỷ lệ trúng tuyển vị trí Lead/Manager.",
      "Đối với vị trí Quản lý: Bổ sung minh chứng số lượng nhân sự đã dẫn dắt và quy mô ngân sách dự án vào CV.",
      "Đối với vị trí Hybrid BA/DA: Đưa các case-study kết hợp phân tích số liệu SQL với giải pháp quy trình kinh doanh vào vòng phỏng vấn.",
    ];

    return {
      extractedProfile: {
        fullName: mockProfile.fullName,
        targetRole: mockProfile.targetRole,
        detectedSeniority: mockProfile.currentSeniority,
        estimatedYears,
        skillsCount: candidateSkills.length,
        topSkills: candidateSkills.slice(0, 6).map((s) => s.name),
      },
      bestFitJobs,
      growthOpportunities,
      careerRoadmapTips,
    };
  }
}

export const cvMatcherService = new CvMatcherService();
