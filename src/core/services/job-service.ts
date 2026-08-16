import { JobPosting, JobSearchFilters } from "../dtos/job.dto";
import { ApplicationRecord, CandidateProfile } from "../dtos/profile.dto";
import { JobMatchScoreResult } from "../dtos/scoring.dto";
import { jobRepository } from "../repositories/job-repository";
import { profileRepository } from "../repositories/profile-repository";
import { scoringService } from "./scoring-service";
import { scraperService, ScrapeOptions } from "./scraper-service";

export interface JobWithScore extends JobPosting {
  scoreResult: JobMatchScoreResult;
}

export class JobService {
  /**
   * Lấy danh sách việc làm đã được tính điểm tương thích theo hồ sơ ứng viên hiện tại
   */
  public getScoredJobs(filters: JobSearchFilters = {}): {
    jobs: JobWithScore[];
    totalCount: number;
    profile: CandidateProfile;
  } {
    const profile = profileRepository.getProfile();
    const rawJobs = jobRepository.filterJobs(filters);

    let scoredJobs: JobWithScore[] = rawJobs.map((job) => {
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
  public getJobDetailWithScore(id: string): JobWithScore | undefined {
    const job = jobRepository.getJobById(id);
    if (!job) return undefined;

    const profile = profileRepository.getProfile();
    const scoreResult = scoringService.calculateMatchScore(profile, job);

    return {
      ...job,
      scoreResult,
    };
  }

  /**
   * Thực hiện cào thêm dữ liệu từ LinkedIn và bổ sung vào kho lưu trữ
   */
  public async scrapeAndIngestJobs(options: ScrapeOptions): Promise<{ addedCount: number; totalJobs: number }> {
    const scrapedJobs = await scraperService.scrapeLinkedInJobs(options);
    const addedCount = jobRepository.addBulkJobs(scrapedJobs);
    const totalJobs = jobRepository.getAllJobs().length;

    return { addedCount, totalJobs };
  }

  /**
   * Phân tích và chấm điểm một bản JD tùy biến
   */
  public scoreCustomJD(
    title: string,
    company: string,
    rawText: string,
    location?: "HO_CHI_MINH" | "DONG_NAI",
    url?: string
  ): JobWithScore {
    const profile = profileRepository.getProfile();
    const job = scraperService.parseCustomJDText(title, company, rawText, location, url);
    const scoreResult = scoringService.calculateMatchScore(profile, job);

    // Lưu vào repository để người dùng có thể tra cứu lại
    jobRepository.addJob(job);

    return {
      ...job,
      scoreResult,
    };
  }

  /**
   * Quản lý tiến trình ứng tuyển
   */
  public getApplications(): ApplicationRecord[] {
    return profileRepository.getApplications();
  }

  public trackJobApplication(jobId: string, status: ApplicationRecord["status"], notes?: string): ApplicationRecord {
    const jobWithScore = this.getJobDetailWithScore(jobId);
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
