import { ALL_TAXONOMY_SKILLS, TaxonomySkillItem } from "../constants/skills.taxonomy";
import { DEFAULT_SYSTEM_CONFIG, ScoringWeightsConfig } from "../constants/app-config";
import { JobPosting, SkillRequirement } from "../dtos/job.dto";
import { CandidateProfile, CandidateSkill } from "../dtos/profile.dto";
import {
  GapAnalysisResult,
  JobMatchScoreResult,
  RadarMetric,
  ScoreBreakdown,
  SkillMatchDetail,
} from "../dtos/scoring.dto";

export class ScoringService {
  /**
   * Tính toán độ phù hợp toàn diện giữa Hồ sơ ứng viên và Tin tuyển dụng với trọng số tham số hóa
   */
  public calculateMatchScore(
    candidate: CandidateProfile,
    job: JobPosting,
    customWeights?: Partial<ScoringWeightsConfig>
  ): JobMatchScoreResult {
    const weights: ScoringWeightsConfig = {
      ...DEFAULT_SYSTEM_CONFIG.scoringWeights,
      ...customWeights,
    };

    const candidateSkillMap = new Map<string, CandidateSkill>();
    for (const skill of candidate.skills) {
      candidateSkillMap.set(skill.name.toLowerCase().trim(), skill);
    }

    const skillDetails: SkillMatchDetail[] = [];
    let coreMatchedPoints = 0;
    let coreTotalPoints = 0;
    let secondaryMatchedPoints = 0;
    let secondaryTotalPoints = 0;

    const matchedSkillNames: string[] = [];
    const missingMustHave: SkillRequirement[] = [];
    const missingGoodToHave: SkillRequirement[] = [];

    for (const req of job.extractedSkills) {
      const isMustHave = req.importance === "MUST_HAVE";
      const isCore = req.category === "CORE";

      const weight = isCore
        ? isMustHave
          ? weights.coreMustHaveWeight
          : weights.coreGoodToHaveWeight
        : isMustHave
        ? weights.secondaryMustHaveWeight
        : weights.secondaryGoodToHaveWeight;

      const candidateSkill = this.findMatchingCandidateSkill(req.name, candidateSkillMap);

      if (isCore) {
        coreTotalPoints += weight;
        if (candidateSkill) {
          const profMultiplier = candidateSkill.proficiencyLevel / 5;
          coreMatchedPoints += weight * Math.max(weights.minProficiencyFloor, profMultiplier);
          matchedSkillNames.push(req.name);
        } else {
          if (isMustHave) missingMustHave.push(req);
          else missingGoodToHave.push(req);
        }
      } else {
        secondaryTotalPoints += weight;
        if (candidateSkill) {
          const profMultiplier = candidateSkill.proficiencyLevel / 5;
          secondaryMatchedPoints += weight * Math.max(0.6, profMultiplier);
          matchedSkillNames.push(req.name);
        } else {
          if (isMustHave) missingMustHave.push(req);
          else missingGoodToHave.push(req);
        }
      }

      skillDetails.push({
        skillName: req.name,
        category: req.category,
        importance: req.importance,
        isMatched: !!candidateSkill,
        candidateProficiency: candidateSkill ? candidateSkill.proficiencyLevel : 0,
        weight,
      });
    }

    // Điểm kỹ năng cốt lõi (Tối đa 50)
    const coreScore = coreTotalPoints > 0 ? (coreMatchedPoints / coreTotalPoints) * 50 : 40;

    // Điểm kỹ năng phụ trợ / công cụ (Tối đa 20)
    const secondaryScore = secondaryTotalPoints > 0 ? (secondaryMatchedPoints / secondaryTotalPoints) * 20 : 16;

    // Điểm cấp bậc kinh nghiệm (Tối đa 15)
    const seniorityScore = this.calculateSeniorityScore(
      candidate.currentSeniority,
      job.seniority,
      candidate.yearsOfTotalExperience,
      job.experienceYearsRequired || 0
    );

    // Điểm địa điểm (Tối đa 10)
    const locationScore = this.calculateLocationScore(candidate.preferredLocations, job.location, job.workMode);

    // Điểm chứng chỉ và học vấn (Tối đa 5)
    const certScore = candidate.certifications && candidate.certifications.length > 0 ? 5 : 3;

    const totalRaw = Math.round(coreScore + secondaryScore + seniorityScore + locationScore + certScore);
    const totalScore = Math.min(100, Math.max(10, totalRaw));

    const breakdown: ScoreBreakdown = {
      coreSkillsScore: Math.round(coreScore * 10) / 10,
      secondarySkillsScore: Math.round(secondaryScore * 10) / 10,
      seniorityScore: Math.round(seniorityScore * 10) / 10,
      locationScore: Math.round(locationScore * 10) / 10,
      certificationScore: Math.round(certScore * 10) / 10,
      totalScore,
    };

    const scoreTier = this.determineScoreTier(totalScore);
    const radarData = this.generateRadarMetrics(candidate, job);
    const gapAnalysis = this.generateGapAnalysis(
      matchedSkillNames,
      missingMustHave,
      missingGoodToHave,
      job
    );

    return {
      jobId: job.id,
      totalScore,
      scoreTier,
      breakdown,
      radarData,
      gapAnalysis,
      skillDetails,
    };
  }

  /**
   * Trích xuất các kỹ năng từ nội dung văn bản JD dựa trên Taxonomy chuẩn
   */
  public extractSkillsFromText(jdText: string): SkillRequirement[] {
    const textLower = jdText.toLowerCase();
    const extractedMap = new Map<string, SkillRequirement>();

    for (const taxonomyItem of ALL_TAXONOMY_SKILLS) {
      let isFound = false;
      if (textLower.includes(taxonomyItem.name.toLowerCase())) {
        isFound = true;
      } else {
        for (const alias of taxonomyItem.aliases) {
          if (textLower.includes(alias.toLowerCase())) {
            isFound = true;
            break;
          }
        }
      }

      if (isFound) {
        // Xác định tầm quan trọng dựa trên ngữ cảnh từ khóa
        const isMustHave =
          textLower.includes("bắt buộc") ||
          textLower.includes("yêu cầu") ||
          textLower.includes("must") ||
          textLower.includes("required") ||
          taxonomyItem.category === "CORE";

        extractedMap.set(taxonomyItem.name, {
          name: taxonomyItem.name,
          category: taxonomyItem.category,
          importance: isMustHave ? "MUST_HAVE" : "GOOD_TO_HAVE",
        });
      }
    }

    return Array.from(extractedMap.values());
  }

  private findMatchingCandidateSkill(
    reqSkillName: string,
    candidateSkillMap: Map<string, CandidateSkill>
  ): CandidateSkill | undefined {
    const reqLower = reqSkillName.toLowerCase().trim();
    if (candidateSkillMap.has(reqLower)) {
      return candidateSkillMap.get(reqLower);
    }

    // Tìm kiếm tương đối qua từ khóa alias
    for (const tax of ALL_TAXONOMY_SKILLS) {
      if (tax.name.toLowerCase() === reqLower || tax.aliases.some((a) => a.toLowerCase() === reqLower)) {
        for (const [candName, candSkill] of candidateSkillMap.entries()) {
          if (tax.name.toLowerCase() === candName || tax.aliases.some((a) => a.toLowerCase() === candName)) {
            return candSkill;
          }
        }
      }
    }
    return undefined;
  }

  private calculateSeniorityScore(
    candidateSeniority: string,
    jobSeniority: string,
    candidateYears: number,
    requiredYears: number
  ): number {
    if (candidateYears >= requiredYears) {
      return 15;
    }
    if (candidateSeniority === jobSeniority) {
      return 13;
    }
    const diff = requiredYears - candidateYears;
    if (diff <= 1) return 10;
    if (diff <= 2) return 7;
    return 4;
  }

  private calculateLocationScore(
    preferred: string[],
    jobLocation: string,
    workMode: string
  ): number {
    if (workMode === "REMOTE") return 10;
    if (preferred.includes(jobLocation)) return 10;
    if (preferred.includes("HO_CHI_MINH") && jobLocation === "DONG_NAI") return 8; // Giáp ranh
    if (preferred.includes("DONG_NAI") && jobLocation === "HO_CHI_MINH") return 8;
    return 5;
  }

  private determineScoreTier(
    score: number
  ): "PERFECT_MATCH" | "HIGH_MATCH" | "MODERATE_MATCH" | "LOW_MATCH" {
    if (score >= 85) return "PERFECT_MATCH";
    if (score >= 70) return "HIGH_MATCH";
    if (score >= 50) return "MODERATE_MATCH";
    return "LOW_MATCH";
  }

  private generateRadarMetrics(candidate: CandidateProfile, job: JobPosting): RadarMetric[] {
    const categories = [
      { key: "Requirements & BABOK", targetCategory: "CORE", defaultReq: 85 },
      { key: "Data & SQL Querying", targetCategory: "CORE", defaultReq: 80 },
      { key: "BI & Visualization Tools", targetCategory: "TOOL", defaultReq: 75 },
      { key: "Process & Modeling", targetCategory: "CORE", defaultReq: 70 },
      { key: "Domain & Soft Skills", targetCategory: "DOMAIN", defaultReq: 75 },
    ];

    return categories.map((cat) => {
      const reqVal = cat.defaultReq;
      // Tính điểm trung bình ứng viên theo nhóm
      let candTotal = 0;
      let count = 0;
      for (const skill of candidate.skills) {
        if (skill.category === cat.targetCategory || cat.key.toLowerCase().includes(skill.name.toLowerCase())) {
          candTotal += (skill.proficiencyLevel / 5) * 100;
          count++;
        }
      }
      const candVal = count > 0 ? Math.round(candTotal / count) : 60;
      return {
        subject: cat.key,
        required: reqVal,
        candidate: Math.min(100, candVal),
        fullMark: 100,
      };
    });
  }

  private generateGapAnalysis(
    matchedSkills: string[],
    missingMustHave: SkillRequirement[],
    missingGoodToHave: SkillRequirement[],
    job: JobPosting
  ): GapAnalysisResult {
    const strongestAreas = matchedSkills.slice(0, 4);

    const improvementSuggestions: string[] = [];
    if (missingMustHave.length > 0) {
      const skillsStr = missingMustHave.map((s) => s.name).join(", ");
      improvementSuggestions.push(`Bổ sung các kỹ năng bắt buộc còn thiếu vào CV: ${skillsStr}.`);
    }
    if (missingGoodToHave.length > 0) {
      const skillsStr = missingGoodToHave.map((s) => s.name).join(", ");
      improvementSuggestions.push(`Nâng cao kiến thức và công cụ phụ trợ: ${skillsStr}.`);
    }
    if (job.roleCategory === "BUSINESS_ANALYST") {
      improvementSuggestions.push("Nhấn mạnh kinh nghiệm viết BRD/SRS, vẽ quy trình BPMN và điều phối nghiệm thu UAT.");
    } else {
      improvementSuggestions.push("Làm nổi bật dự án xử lý dữ liệu với SQL, tối ưu mô hình DAX và thiết kế dashboard kinh doanh.");
    }

    const interviewPrepTips: string[] = [
      `Chuẩn bị các tình huống thực tế (STAR Method) giải quyết bài toán nghiệp vụ cho vị trí ${job.title}.`,
      "Thực hành giải thích logic truy vấn dữ liệu hoặc các bước đặc tả yêu cầu khi làm việc với các bên liên quan.",
      `Tìm hiểu sâu về mô hình vận hành và domain của công ty ${job.company}.`,
    ];

    return {
      matchedSkills,
      missingMustHaveSkills: missingMustHave,
      missingGoodToHaveSkills: missingGoodToHave,
      strongestAreas,
      improvementSuggestions,
      interviewPrepTips,
    };
  }
}

export const scoringService = new ScoringService();
