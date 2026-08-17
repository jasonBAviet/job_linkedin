import { JobPosting, JobSearchFilters } from "../dtos/job.dto";
import { classifySeniority } from "../utils/role-classifier";
import { ApplicationRecord, CandidateProfile } from "../dtos/profile.dto";
import { JobWithScore } from "../dtos/job-with-score.dto";
import { jobRepository } from "../repositories/job-repository";
import { profileRepository } from "../repositories/profile-repository";
import { scoringService } from "./scoring-service";
import { scraperService } from "./scraper-service";

// Định nghĩa đã chuyển sang DTO thuần để component client không kéo pg/ssh2 vào bundle.
// Giữ re-export để mọi import cũ vẫn chạy.
export type { JobWithScore } from "../dtos/job-with-score.dto";

export class JobService {
  /**
   * Chuẩn hóa lại các trường được suy đoán trước khi chấm điểm và trả về UI.
   *
   * Các bản ghi đã nằm trong DB được phân loại bằng logic cũ (quét cả phần mô tả nên
   * "Business Analyst, Internship" thành LEAD_MANAGER, và mặc định về SENIOR khi không
   * đoán được). Chuẩn hóa lúc đọc giúp cả điểm số lẫn thông tin hiển thị cùng đúng
   * mà không phải nạp lại toàn bộ dữ liệu.
   */
  private normalizeInference<T extends JobPosting>(job: T): T {
    const fromTitle = classifySeniority(job.title || "");
    if (!fromTitle?.fromTitle || fromTitle.level === job.seniority) return job;

    return {
      ...job,
      seniority: fromTitle.level,
      experienceYearsRequired: fromTitle.experienceYears,
      inferredFields: Array.from(
        new Set([...(job.inferredFields || []), "seniority", "experienceYearsRequired"])
      ),
    };
  }

  /**
   * Lấy danh sách việc làm đã được tính điểm tương thích theo hồ sơ ứng viên hiện tại
   */
  public async getScoredJobs(filters: JobSearchFilters = {}): Promise<{
    jobs: JobWithScore[];
    totalCount: number;
    profile: CandidateProfile;
  }> {
    // Chạy song song: hồ sơ và danh sách job không phụ thuộc nhau
    const [profile, rawJobs] = await Promise.all([
      profileRepository.getProfile(),
      jobRepository.filterJobs(filters),
    ]);

    let scoredJobs: JobWithScore[] = rawJobs.map((rawJob) => {
      const job = this.normalizeInference(rawJob);
      const scoreResult = scoringService.calculateMatchScore(profile, job);
      return {
        ...job,
        scoreResult,
      };
    });

    // Lọc theo điểm số tối thiểu nếu có
    if (filters.minScore !== undefined && filters.minScore > 0) {
      scoredJobs = scoredJobs.filter((j) => j.scoreResult.totalScore >= (filters.minScore || 0));
    }

    // Sắp xếp mặc định theo điểm phù hợp giảm dần
    scoredJobs.sort((a, b) => b.scoreResult.totalScore - a.scoreResult.totalScore);

    return {
      jobs: scoredJobs,
      totalCount: scoredJobs.length,
      profile,
    };
  }

  /**
   * Lấy chi tiết việc làm cùng phân tích điểm chuyên sâu
   */
  public async getJobDetailWithScore(id: string): Promise<JobWithScore | undefined> {
    const rawJob = await jobRepository.getJobById(id);
    if (!rawJob) return undefined;

    const job = this.normalizeInference(rawJob);
    const profile = await profileRepository.getProfile();
    const scoreResult = scoringService.calculateMatchScore(profile, job);

    return {
      ...job,
      scoreResult,
    };
  }

  /**
   * Phân tích và chấm điểm một bản JD tùy biến
   */
  public async scoreCustomJD(
    title: string,
    company: string,
    rawText: string,
    location?: "HO_CHI_MINH" | "DONG_NAI",
    url?: string
  ): Promise<JobWithScore> {
    const profile = await profileRepository.getProfile();
    const job = scraperService.parseCustomJDText(title, company, rawText, location, url);
    const scoreResult = scoringService.calculateMatchScore(profile, job);

    // Lưu vào repository để người dùng có thể tra cứu lại
    await jobRepository.addJob(job);

    return {
      ...job,
      scoreResult,
    };
  }

  /**
   * Quản lý tiến trình ứng tuyển
   */
  public async getApplications(): Promise<ApplicationRecord[]> {
    return profileRepository.getApplications();
  }

  public async trackJobApplication(jobId: string, status: ApplicationRecord["status"], notes?: string): Promise<ApplicationRecord> {
    const jobWithScore = await this.getJobDetailWithScore(jobId);
    return profileRepository.saveOrUpdateApplication({
      jobId,
      status,
      matchScoreAtApply: jobWithScore ? jobWithScore.scoreResult.totalScore : 0,
      notes: notes || "",
      appliedDate: new Date().toISOString().split("T")[0],
    });
  }
}

export const jobService = new JobService();
