import { ALL_TAXONOMY_SKILLS } from "../constants/skills.taxonomy";
import {
  DEFAULT_SYSTEM_CONFIG,
  SCORE_TIER_THRESHOLDS,
  ScoringWeightsConfig,
} from "../constants/app-config";
import { JobPosting, SkillRequirement } from "../dtos/job.dto";
import { CandidateProfile, CandidateSkill } from "../dtos/profile.dto";
import {
  GapAnalysisResult,
  JobMatchScoreResult,
  ScoreBreakdown,
  ScoreEvidence,
  ScoreEvidenceLevel,
  SkillMatchDetail,
} from "../dtos/scoring.dto";
import { findKeywordIndex, matchKeyword } from "../utils/text-matching";
import { classifySeniority, isUnrelatedRole, seniorityRank } from "../utils/role-classifier";

/** Tra cứu trọng số gốc của từng kỹ năng theo taxonomy */
const TAXONOMY_WEIGHT_BY_NAME = new Map<string, number>(
  ALL_TAXONOMY_SKILLS.map((item) => [item.name.toLowerCase(), item.defaultWeight])
);

/** Số ký tự lấy quanh vị trí từ khóa để xét kỹ năng đó có bắt buộc hay không */
const IMPORTANCE_CONTEXT_WINDOW = 220;

/** Độ dài mô tả tối thiểu để tin tưởng kết quả trích xuất lại lúc chấm điểm */
const MIN_JD_LENGTH_FOR_REEXTRACT = 200;

const MUST_HAVE_MARKERS = [
  "bắt buộc",
  "yêu cầu",
  "must have",
  "must-have",
  "required",
  "requirement",
  "thành thạo",
  "vững",
];

const GOOD_TO_HAVE_MARKERS = [
  "ưu tiên",
  "là lợi thế",
  "lợi thế",
  "nice to have",
  "nice-to-have",
  "plus",
  "preferred",
  "a plus",
  "bonus",
];

export class ScoringService {
  /**
   * Tính mức độ đáng nộp đơn giữa hồ sơ ứng viên và tin tuyển dụng.
   *
   * Điểm gồm bốn chiều thực sự biến thiên giữa các job. Chứng chỉ đã bị loại khỏi
   * công thức vì nó là thuộc tính của ứng viên nên bằng nhau ở mọi job; địa điểm
   * chuyển thành hệ số nhân vì gần như mọi job đều đạt điểm tối đa ở chiều này.
   * Không còn điểm sàn cho không: JD không nêu yêu cầu nào thì không có căn cứ
   * để cộng điểm, và được đánh dấu qua `evidence` thay vì âm thầm nâng điểm.
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
    const matchedSkillNames: string[] = [];
    const missingMustHave: SkillRequirement[] = [];
    const missingGoodToHave: SkillRequirement[] = [];

    let requiredWeight = 0;
    let earnedWeight = 0;

    const requirements = this.resolveRequirements(job);

    for (const req of requirements) {
      const isMustHave = req.importance === "MUST_HAVE";
      const baseWeight = TAXONOMY_WEIGHT_BY_NAME.get(req.name.toLowerCase()) ?? 5;
      const weight = baseWeight * (isMustHave ? 1 : weights.goodToHaveWeightRatio);

      const candidateSkill = this.findMatchingCandidateSkill(req.name, candidateSkillMap);

      requiredWeight += weight;
      if (candidateSkill) {
        // Không còn sàn 0.6: trình độ 1/5 phải khác hẳn trình độ 5/5
        earnedWeight += weight * (candidateSkill.proficiencyLevel / 5);
        matchedSkillNames.push(req.name);
      } else if (isMustHave) {
        missingMustHave.push(req);
      } else {
        missingGoodToHave.push(req);
      }

      skillDetails.push({
        skillName: req.name,
        category: req.category,
        importance: req.importance,
        isMatched: !!candidateSkill,
        candidateProficiency: candidateSkill ? candidateSkill.proficiencyLevel : 0,
        weight: Math.round(weight * 10) / 10,
      });
    }

    // Độ phủ kỹ năng — tín hiệu chính. JD không nêu kỹ năng nào thì không xác định được.
    const coverageRatio = requiredWeight > 0 ? earnedWeight / requiredWeight : null;

    const mustHavePenalty =
      1 -
      weights.missingMustHavePenalty *
        Math.min(weights.maxMissingMustHavePenalties, missingMustHave.length);

    // Độ tin cậy của tỷ lệ độ phủ: tỷ lệ 1/1 không đáng tin bằng 10/10 nhưng cả hai
    // đều bằng 100%. Không có bước này, một JD chỉ vô tình chứa đúng một từ khóa kỹ năng
    // sẽ ăn trọn điểm — đúng lỗi mà công thức cũ mắc phải, chỉ đổi hình thức.
    const evidenceConfidence = Math.min(1, requiredWeight / weights.fullEvidenceWeight);

    const skillCoverageScore =
      coverageRatio === null
        ? 0
        : weights.skillCoverageMax *
          coverageRatio *
          Math.max(0, mustHavePenalty) *
          evidenceConfidence;

    const roleRelevanceScore = this.calculateRoleRelevance(candidate, job, weights);
    const seniorityFitScore = this.calculateSeniorityFit(candidate, job, weights);
    const opportunityScore = this.calculateOpportunityScore(job, weights);
    const locationMultiplier = this.calculateLocationMultiplier(
      candidate.preferredLocations,
      job.location,
      job.workMode,
      weights
    );

    const rawTotal =
      (skillCoverageScore + roleRelevanceScore + seniorityFitScore + opportunityScore) *
      locationMultiplier;
    const totalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

    const breakdown: ScoreBreakdown = {
      skillCoverageScore: Math.round(skillCoverageScore * 10) / 10,
      roleRelevanceScore: Math.round(roleRelevanceScore * 10) / 10,
      seniorityFitScore: Math.round(seniorityFitScore * 10) / 10,
      opportunityScore: Math.round(opportunityScore * 10) / 10,
      locationMultiplier: Math.round(locationMultiplier * 100) / 100,
      totalScore,
    };

    return {
      jobId: job.id,
      totalScore,
      scoreTier: this.determineScoreTier(totalScore),
      breakdown,
      coverageRatio: coverageRatio === null ? null : Math.round(coverageRatio * 1000) / 1000,
      evidence: this.deriveEvidence(job, requirements, weights),
      gapAnalysis: this.generateGapAnalysis(
        matchedSkillNames,
        missingMustHave,
        missingGoodToHave,
        job
      ),
      skillDetails,
    };
  }

  /**
   * Lấy danh sách yêu cầu kỹ năng dùng để chấm điểm.
   *
   * Ưu tiên trích xuất lại từ mô tả gốc thay vì tin vào cột extractedSkills đã lưu:
   * dữ liệu trong DB được sinh bằng phiên bản extractor cũ, vốn đánh dấu gần như mọi
   * kỹ năng là MUST_HAVE và quét cả tên công ty. Nhờ vậy các bản ghi cũ được chấm đúng
   * ngay mà không cần chạy lại toàn bộ quá trình nạp dữ liệu.
   */
  private resolveRequirements(job: JobPosting): SkillRequirement[] {
    const source = job.rawContent || job.jobDescription;
    if (source && source.length >= MIN_JD_LENGTH_FOR_REEXTRACT) {
      return this.extractSkillsFromText(`${job.title} ${source}`);
    }
    return job.extractedSkills ?? [];
  }

  /**
   * Mức độ vai trò của job trùng với định hướng nghề nghiệp.
   *
   * Không tin tuyệt đối vào cột roleCategory: nó được suy đoán ở hầu hết bản ghi và
   * mặc định về BUSINESS_ANALYST khi không phân loại được, nên một tin Graphic Designer
   * vẫn mang nhãn BA. Tiêu đề được dùng để kiểm chứng lại.
   */
  private calculateRoleRelevance(
    candidate: CandidateProfile,
    job: JobPosting,
    weights: ScoringWeightsConfig
  ): number {
    if (isUnrelatedRole(job.title)) return 0;

    const jobRole = job.roleCategory;
    const targetRole = candidate.targetRole;

    let affinity: number;
    if (jobRole === targetRole) {
      affinity = 1;
    } else if (jobRole === "HYBRID_BA_DA" || targetRole === "HYBRID_BA_DA") {
      // Hồ sơ lai phù hợp với cả hai nhánh
      affinity = 0.8;
    } else {
      // BA và DA là hai nhánh khác nhau nhưng có phần giao
      affinity = 0.5;
    }

    // Tiêu đề không hề nhắc tới BA/DA nghĩa là nhãn vai trò chỉ là suy đoán
    const titleLower = (job.title || "").toLowerCase();
    const hasTitleSignal = DEFAULT_SYSTEM_CONFIG.roleCategories.some((rule) =>
      rule.titleKeywords.some((kw) => matchKeyword(titleLower, kw))
    );
    if (!hasTitleSignal) affinity *= 0.5;

    return weights.roleRelevanceMax * affinity;
  }

  /**
   * Mức khớp cấp bậc, phạt cả thiếu lẫn thừa kinh nghiệm.
   *
   * Chỉ dùng một tín hiệu là cấp bậc. Trường experienceYearsRequired bị bỏ qua vì
   * nó chỉ là defaultExperienceYears sao chép từ cấu hình theo cấp bậc — dùng cả hai
   * là chấm cùng một thông tin hai lần.
   */
  private calculateSeniorityFit(
    candidate: CandidateProfile,
    job: JobPosting,
    weights: ScoringWeightsConfig
  ): number {
    const max = weights.seniorityFitMax;

    // Kiểm chứng lại cấp bậc đã lưu bằng tiêu đề: các bản ghi cũ được phân loại
    // bằng logic quét cả phần mô tả nên "Business Analyst, Internship" bị gán LEAD_MANAGER.
    const fromTitle = classifySeniority(job.title || "");
    const effectiveSeniority = fromTitle?.fromTitle ? fromTitle.level : job.seniority;

    if (!effectiveSeniority) return max * 0.5;

    const distance = seniorityRank(effectiveSeniority) - seniorityRank(candidate.currentSeniority);

    if (distance === 0) return max;
    // Vươn lên một bậc vẫn rất đáng nộp đơn; thừa một bậc cũng chấp nhận được
    if (distance === 1 || distance === -1) return max * 0.7;
    // Với quá cao hoặc thừa quá nhiều
    if (distance >= 2) return max * 0.3;
    return max * 0.2;
  }

  /**
   * Mức độ đáng nộp đơn xét theo cạnh tranh.
   *
   * Chỉ dùng applicantCount làm tín hiệu chính; competitionLevel bị bỏ qua khi đã có
   * applicantCount vì nó được suy ra trực tiếp từ chính con số đó (ngưỡng 25 và 100),
   * dùng cả hai sẽ là đếm hai lần. isActivelyReviewing đến từ nguồn khác nên độc lập.
   */
  private calculateOpportunityScore(job: JobPosting, weights: ScoringWeightsConfig): number {
    const max = weights.opportunityMax;

    let competitionFactor: number;
    if (typeof job.applicantCount === "number") {
      if (job.applicantCount <= 10) competitionFactor = 1;
      else if (job.applicantCount <= 25) competitionFactor = 0.85;
      else if (job.applicantCount <= 50) competitionFactor = 0.6;
      else if (job.applicantCount <= 100) competitionFactor = 0.35;
      else competitionFactor = 0.15;
    } else {
      switch (job.competitionLevel) {
        case "LOW":
          competitionFactor = 0.85;
          break;
        case "MEDIUM":
          competitionFactor = 0.6;
          break;
        case "HIGH":
          competitionFactor = 0.25;
          break;
        default:
          competitionFactor = 0.5;
      }
    }

    const reviewingFactor = job.isActivelyReviewing ? 1 : 0.5;

    return max * (competitionFactor * 0.65 + reviewingFactor * 0.35);
  }

  /**
   * Địa điểm là hệ số nhân chứ không phải điểm cộng: 119/122 job đều đạt điểm tối đa
   * ở chiều này nên cộng điểm chỉ làm tăng nền chung mà không phân biệt được job nào.
   */
  private calculateLocationMultiplier(
    preferred: string[],
    jobLocation: string,
    workMode: string,
    weights: ScoringWeightsConfig
  ): number {
    if (workMode === "REMOTE") return 1;
    if (preferred.includes(jobLocation)) return 1;
    if (workMode === "HYBRID") return weights.locationAdjacentMultiplier;
    return weights.locationMismatchMultiplier;
  }

  /**
   * Đánh giá độ tin cậy của dữ liệu JD. Tách khỏi điểm số để người dùng phân biệt
   * "job không phù hợp" với "JD viết quá sơ sài nên không đủ căn cứ chấm".
   */
  private deriveEvidence(
    job: JobPosting,
    requirements: SkillRequirement[],
    weights: ScoringWeightsConfig
  ): ScoreEvidence {
    const extractedSkillCount = requirements.length;
    const jdLength = (job.rawContent || job.jobDescription || "").length;
    const inferredFields = job.inferredFields ?? [];

    let level: ScoreEvidenceLevel;
    let reason: string | undefined;

    if (extractedSkillCount === 0) {
      level = "LOW";
      reason = "Không trích được kỹ năng nào từ mô tả công việc.";
    } else if (
      extractedSkillCount < weights.minSkillsForFullEvidence ||
      jdLength < weights.minJdLengthForFullEvidence
    ) {
      level = "LOW";
      reason = `Mô tả công việc quá ngắn hoặc chỉ nêu ${extractedSkillCount} kỹ năng, chưa đủ căn cứ chấm điểm.`;
    } else if (inferredFields.length > 2) {
      level = "MEDIUM";
      reason = "Một số trường quan trọng được suy đoán thay vì lấy trực tiếp từ tin tuyển dụng.";
    } else {
      level = "HIGH";
    }

    return { level, extractedSkillCount, inferredFields, reason };
  }

  /**
   * Trích xuất kỹ năng từ mô tả công việc dựa trên taxonomy chuẩn.
   */
  public extractSkillsFromText(jdText: string): SkillRequirement[] {
    const textLower = jdText.toLowerCase();
    const extractedMap = new Map<string, SkillRequirement>();

    for (const taxonomyItem of ALL_TAXONOMY_SKILLS) {
      let matchIndex = findKeywordIndex(textLower, taxonomyItem.name);

      if (matchIndex === -1) {
        for (const alias of taxonomyItem.aliases) {
          matchIndex = findKeywordIndex(textLower, alias);
          if (matchIndex !== -1) break;
        }
      }

      if (matchIndex === -1) continue;

      extractedMap.set(taxonomyItem.name, {
        name: taxonomyItem.name,
        category: taxonomyItem.category,
        importance: this.resolveImportance(
          textLower,
          matchIndex,
          taxonomyItem.category === "CORE"
        ),
      });
    }

    return Array.from(extractedMap.values());
  }

  /**
   * Xác định kỹ năng là bắt buộc hay ưu tiên dựa trên ngữ cảnh ngay quanh nó.
   *
   * Trước đây điều kiện được xét trên toàn bộ tài liệu: chỉ cần JD có chữ "yêu cầu"
   * ở bất kỳ đâu là mọi kỹ năng đều thành MUST_HAVE, khiến GOOD_TO_HAVE gần như
   * không tồn tại và phần trọng số dành cho nó trở thành code chết.
   */
  private resolveImportance(
    textLower: string,
    matchIndex: number,
    isCoreSkill: boolean
  ): "MUST_HAVE" | "GOOD_TO_HAVE" {
    const start = Math.max(0, matchIndex - IMPORTANCE_CONTEXT_WINDOW);
    const end = Math.min(textLower.length, matchIndex + IMPORTANCE_CONTEXT_WINDOW);
    const context = textLower.substring(start, end);

    // "Ưu tiên / là lợi thế" thắng vì nó là tín hiệu cụ thể hơn, thường nằm sát kỹ năng
    if (GOOD_TO_HAVE_MARKERS.some((marker) => context.includes(marker))) {
      return "GOOD_TO_HAVE";
    }
    if (MUST_HAVE_MARKERS.some((marker) => context.includes(marker))) {
      return "MUST_HAVE";
    }

    // Không có tín hiệu rõ ràng: dựa vào phân loại của taxonomy. Kỹ năng CORE là kỹ năng
    // định nghĩa nên nghề, xuất hiện trong JD thì mặc nhiên được coi là yêu cầu chính.
    return isCoreSkill ? "MUST_HAVE" : "GOOD_TO_HAVE";
  }

  /**
   * Tìm kỹ năng tương ứng trong hồ sơ ứng viên.
   *
   * Chỉ chấp nhận khớp chính xác theo tên chuẩn hoặc alias của taxonomy. Cách cũ
   * chấp nhận hai chuỗi chứa lẫn nhau và trả về kết quả đầu tiên, nên một kỹ năng
   * có tên ngắn có thể bị gán nhầm cho yêu cầu không liên quan.
   */
  private findMatchingCandidateSkill(
    reqSkillName: string,
    candidateSkillMap: Map<string, CandidateSkill>
  ): CandidateSkill | undefined {
    const reqLower = reqSkillName.toLowerCase().trim();

    const direct = candidateSkillMap.get(reqLower);
    if (direct) return direct;

    const taxonomyItem = ALL_TAXONOMY_SKILLS.find(
      (tax) =>
        tax.name.toLowerCase() === reqLower ||
        tax.aliases.some((alias) => alias.toLowerCase() === reqLower)
    );
    if (!taxonomyItem) return undefined;

    // Ứng viên có thể ghi kỹ năng bằng một alias khác của cùng mục taxonomy
    for (const alias of taxonomyItem.aliases) {
      const bySkillAlias = candidateSkillMap.get(alias.toLowerCase());
      if (bySkillAlias) return bySkillAlias;
    }

    return candidateSkillMap.get(taxonomyItem.name.toLowerCase());
  }

  private determineScoreTier(
    score: number
  ): "PERFECT_MATCH" | "HIGH_MATCH" | "MODERATE_MATCH" | "LOW_MATCH" {
    if (score >= SCORE_TIER_THRESHOLDS.PERFECT_MATCH) return "PERFECT_MATCH";
    if (score >= SCORE_TIER_THRESHOLDS.HIGH_MATCH) return "HIGH_MATCH";
    if (score >= SCORE_TIER_THRESHOLDS.MODERATE_MATCH) return "MODERATE_MATCH";
    return "LOW_MATCH";
  }

  private generateGapAnalysis(
    matchedSkills: string[],
    missingMustHave: SkillRequirement[],
    missingGoodToHave: SkillRequirement[],
    job: JobPosting
  ): GapAnalysisResult {
    // Sắp theo trọng số taxonomy để "điểm mạnh" phản ánh kỹ năng có giá trị nhất,
    // thay vì bốn kỹ năng đầu theo thứ tự khai báo taxonomy
    const strongestAreas = [...matchedSkills]
      .sort(
        (a, b) =>
          (TAXONOMY_WEIGHT_BY_NAME.get(b.toLowerCase()) ?? 0) -
          (TAXONOMY_WEIGHT_BY_NAME.get(a.toLowerCase()) ?? 0)
      )
      .slice(0, 4);

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
