import { CandidateProfile, CandidateSkill } from "../dtos/profile.dto";
import type {
  CareerGrowthJob,
  CvMatchingAnalysisResult,
  JobWithScore,
} from "../dtos/job-with-score.dto";
import { scoringService } from "./scoring-service";
import { jobRepository } from "../repositories/job-repository";
import { profileRepository } from "../repositories/profile-repository";
import { matchKeyword } from "../utils/text-matching";
import { ALL_TAXONOMY_SKILLS } from "../constants/skills.taxonomy";

// Định nghĩa đã chuyển sang DTO thuần để component client không kéo pg/ssh2 vào bundle.
// Giữ re-export để mọi import cũ vẫn chạy.
export type { CareerGrowthJob, CvMatchingAnalysisResult } from "../dtos/job-with-score.dto";

export class CvMatcherService {
  /**
   * Phân tích CV thực tế và tìm kiếm việc làm khớp nhất + cơ hội mở rộng sự nghiệp
   */
  public async analyzeAndMatchCv(cvText: string): Promise<CvMatchingAnalysisResult> {
    const textLower = cvText.toLowerCase();
    const extractedSkills = scoringService.extractSkillsFromText(cvText);

    // Phát hiện họ tên ứng viên từ CV
    let candidateName = "Hồ sơ ứng viên";
    const nameMatch = cvText.match(/(?:họ và tên|họ tên|họ & tên|name|full name)\s*[:：\-]\s*([^\n\r,]+)/i);
    if (nameMatch && nameMatch[1]) {
      candidateName = nameMatch[1].trim();
    } else {
      const firstLine = cvText.split("\n").map((l) => l.trim()).filter(Boolean)[0];
      if (
        firstLine &&
        firstLine.length <= 45 &&
        !firstLine.includes(":") &&
        !firstLine.startsWith("#") &&
        !firstLine.startsWith("●") &&
        !firstLine.startsWith("-")
      ) {
        candidateName = firstLine;
      }
    }

    // Phát hiện số năm kinh nghiệm.
    // Neo vào các cụm mô tả tổng kinh nghiệm; nếu bắt bừa con số đầu tiên thì "2 years"
    // nằm trong một gạch đầu dòng của dự án sẽ ghi đè kinh nghiệm của cả hồ sơ.
    let estimatedYears = 4;
    const totalYearMatch = textLower.match(
      /(?:hơn|trên|over|more than|\+)?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:năm|years?|yrs?)\s*(?:kinh nghiệm|of experience|experience|exp\b)/i
    );
    if (totalYearMatch && totalYearMatch[1]) {
      estimatedYears = Math.min(20, Math.max(0.5, parseFloat(totalYearMatch[1])));
    } else {
      // Không có câu tổng kết: lấy con số lớn nhất trong các cụm "N năm / N years"
      const allYearMatches = [...textLower.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:năm|years?|yrs?)\b/gi)]
        .map((m) => parseFloat(m[1]))
        .filter((n) => !Number.isNaN(n) && n <= 20);
      if (allYearMatches.length > 0) {
        estimatedYears = Math.min(20, Math.max(0.5, Math.max(...allYearMatches)));
      }
    }

    // Phát hiện vai trò mục tiêu
    const isDA = textLower.includes("data") || textLower.includes("dữ liệu") || textLower.includes("sql");
    const isBA = textLower.includes("business") || textLower.includes("nghiệp vụ") || textLower.includes("bpmn");
    const targetRole = isDA && isBA ? "HYBRID_BA_DA" : isDA ? "DATA_ANALYST" : "BUSINESS_ANALYST";

    // Phát hiện cấp bậc.
    // Số năm kinh nghiệm là tín hiệu chính; từ khóa chỉ được xét trong phần đầu CV
    // (họ tên, chức danh hiện tại). Quét cả tài liệu khiến một chức danh cũ như
    // "Bakery Manager" đẩy hồ sơ 3 năm kinh nghiệm lên LEAD_MANAGER.
    const headline = textLower.substring(0, 600);
    const hasLeadershipHeadline =
      matchKeyword(headline, "lead") ||
      matchKeyword(headline, "leader") ||
      matchKeyword(headline, "manager") ||
      matchKeyword(headline, "trưởng nhóm") ||
      matchKeyword(headline, "trưởng phòng");

    const detectedSeniority =
      estimatedYears >= 5 || (estimatedYears >= 4 && hasLeadershipHeadline)
        ? "LEAD_MANAGER"
        : estimatedYears >= 3 || matchKeyword(headline, "senior")
        ? "SENIOR"
        : "MIDDLE";

    // Xây dựng Profile thực tế bóc tách từ CV
    const candidateSkills: CandidateSkill[] = extractedSkills.map((s) => ({
      name: s.name,
      category: s.category as any,
      proficiencyLevel: this.inferProficiency(cvText, s.name),
      yearsOfExperience: Math.min(Math.round(estimatedYears), 3),
    }));

    // Lấy các tiêu chí cá nhân từ hồ sơ đã lưu thay vì gán cứng, để điểm của luồng
    // upload CV so sánh được với điểm hiển thị ở trang danh sách việc làm.
    const storedProfile = await profileRepository.getProfile().catch(() => null);

    const candidateProfile: CandidateProfile = {
      id: `cv-candidate-${Date.now()}`,
      fullName: candidateName,
      targetRole,
      currentSeniority: detectedSeniority,
      yearsOfTotalExperience: estimatedYears,
      skills: candidateSkills,
      preferredLocations: storedProfile?.preferredLocations ?? ["HO_CHI_MINH", "DONG_NAI"],
      expectedSalaryVND: storedProfile?.expectedSalaryVND,
      certifications: storedProfile?.certifications,
      rawResumeText: cvText,
      lastUpdated: new Date().toISOString(),
    };

    // Lấy tất cả việc làm thật từ repository
    const allJobs = await jobRepository.getAllJobs();

    // 1. Nhóm Việc Làm Khớp Nhất (Best Fit)
    const bestFitJobs: JobWithScore[] = allJobs
      .map((job) => {
        const scoreResult = scoringService.calculateMatchScore(candidateProfile, job);
        return { ...job, scoreResult };
      })
      .sort((a, b) => (b.scoreResult?.totalScore || 0) - (a.scoreResult?.totalScore || 0));

    // 2. Nhóm Tiềm Năng Mở Rộng & Nâng Cấp Sự Nghiệp (Growth & Progression)
    const growthOpportunities: CareerGrowthJob[] = allJobs
      .filter((j) => j.seniority === "LEAD_MANAGER" || (j.salaryRange?.min && j.salaryRange.min >= 45000000))
      .map((job) => {
        const scoreResult = scoringService.calculateMatchScore(candidateProfile, job);
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
          reasons.push(`Gói thu nhập: ${job.salaryRange.display}`);
        }
        if (job.location === "DONG_NAI") {
          reasons.push("Môi trường Chuỗi cung ứng / Smart Factory công nghiệp");
        }

        return {
          job,
          matchScore: score,
          readinessScore: Math.min(95, Math.max(50, score + 10)),
          salaryUpside: job.salaryRange?.display || "Không công bố",
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
        fullName: candidateProfile.fullName,
        targetRole: candidateProfile.targetRole,
        detectedSeniority: candidateProfile.currentSeniority,
        estimatedYears,
        skillsCount: candidateSkills.length,
        topSkills: candidateSkills.slice(0, 6).map((s) => s.name),
      },
      bestFitJobs,
      growthOpportunities,
      careerRoadmapTips,
    };
  }

  /**
   * Ước lượng mức thành thạo của một kỹ năng từ chính nội dung CV.
   *
   * Trước đây mọi kỹ năng đều bị gán cứng mức 4/5. Vì hệ số thành thạo nhân trực tiếp
   * vào điểm độ phủ, luồng upload CV bị chặn trần và không bao giờ đạt được mức điểm
   * mà hồ sơ lưu trong hệ thống đạt được — hai luồng không so sánh được với nhau.
   */
  private inferProficiency(cvText: string, skillName: string): 1 | 2 | 3 | 4 | 5 {
    const textLower = cvText.toLowerCase();
    const taxonomyItem = ALL_TAXONOMY_SKILLS.find(
      (item) => item.name.toLowerCase() === skillName.toLowerCase()
    );
    const terms = [skillName, ...(taxonomyItem?.aliases ?? [])];

    let mentions = 0;
    let strongestContext = 0;

    for (const term of terms) {
      const termLower = term.toLowerCase();
      let fromIndex = textLower.indexOf(termLower);
      while (fromIndex !== -1) {
        mentions++;
        const context = textLower.substring(
          Math.max(0, fromIndex - 80),
          Math.min(textLower.length, fromIndex + 80)
        );
        if (/thành thạo|chuyên sâu|expert|advanced|nâng cao|chủ trì|dẫn dắt/.test(context)) {
          strongestContext = Math.max(strongestContext, 2);
        } else if (/sử dụng|kinh nghiệm|proficient|experience|thực hiện/.test(context)) {
          strongestContext = Math.max(strongestContext, 1);
        }
        fromIndex = textLower.indexOf(termLower, fromIndex + termLower.length);
      }
    }

    if (mentions === 0) return 3;

    // Nhắc lại nhiều lần trong CV là dấu hiệu kỹ năng được dùng thường xuyên
    const frequencyBoost = mentions >= 4 ? 2 : mentions >= 2 ? 1 : 0;
    const level = 2 + frequencyBoost + strongestContext;

    return Math.min(5, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5;
  }
}

export const cvMatcherService = new CvMatcherService();
