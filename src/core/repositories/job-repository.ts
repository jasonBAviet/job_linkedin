import { JobPosting, JobSearchFilters } from "../dtos/job.dto";
import { INITIAL_JOBS_DATA } from "./mock-jobs.data";

export class JobRepository {
  private jobs: JobPosting[];

  constructor() {
    this.jobs = [...INITIAL_JOBS_DATA];
  }

  public getAllJobs(): JobPosting[] {
    return [...this.jobs];
  }

  public getJobById(id: string): JobPosting | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  public filterJobs(filters: JobSearchFilters): JobPosting[] {
    return this.jobs.filter((job) => {
      // Lọc theo từ khóa
      if (filters.keyword && filters.keyword.trim() !== "") {
        const kw = filters.keyword.toLowerCase().trim();
        const matchesTitle = job.title.toLowerCase().includes(kw);
        const matchesCompany = job.company.toLowerCase().includes(kw);
        const matchesDesc = job.jobDescription.toLowerCase().includes(kw);
        const matchesSkills = job.extractedSkills.some((s) => s.name.toLowerCase().includes(kw));
        if (!matchesTitle && !matchesCompany && !matchesDesc && !matchesSkills) {
          return false;
        }
      }

      // Lọc theo địa điểm
      if (filters.location && filters.location !== "ALL") {
        if (job.location !== filters.location) {
          return false;
        }
      }

      // Lọc theo vai trò (Role Category)
      if (filters.roleCategory && filters.roleCategory !== "ALL") {
        if (job.roleCategory !== filters.roleCategory && job.roleCategory !== "HYBRID_BA_DA") {
          return false;
        }
      }

      // Lọc theo cấp bậc (Seniority)
      if (filters.seniority && filters.seniority !== "ALL") {
        if (filters.seniority === "SENIOR_AND_ABOVE") {
          if (job.seniority !== "SENIOR" && job.seniority !== "LEAD_MANAGER") {
            return false;
          }
        } else if (job.seniority !== filters.seniority) {
          return false;
        }
      }

      // Lọc theo số năm kinh nghiệm tối thiểu (ví dụ: >= 3 năm)
      if (filters.minExperienceYears !== undefined && filters.minExperienceYears > 0) {
        if ((job.experienceYearsRequired || 0) < filters.minExperienceYears) {
          return false;
        }
      }

      // Lọc theo mức lương tối thiểu (> 40 Tr hoặc >= 1600$)
      if (filters.minSalaryVND !== undefined && filters.minSalaryVND > 0) {
        if (!job.salaryRange || !job.salaryRange.min) {
          return false;
        }
        let salaryInVND = job.salaryRange.min;
        if (job.salaryRange.currency === "USD") {
          salaryInVND = job.salaryRange.min * 25400; // Tỷ giá USD/VND
        }
        if (salaryInVND < filters.minSalaryVND) {
          return false;
        }
      }

      // Lọc có hiển thị mức lương
      if (filters.hasSalary) {
        if (!job.salaryRange || !job.salaryRange.min) {
          return false;
        }
      }

      return true;
    });
  }

  public addJob(newJob: JobPosting): JobPosting {
    const existingIndex = this.jobs.findIndex((j) => j.id === newJob.id || j.linkedinUrl === newJob.linkedinUrl);
    if (existingIndex >= 0) {
      this.jobs[existingIndex] = { ...this.jobs[existingIndex], ...newJob };
      return this.jobs[existingIndex];
    } else {
      this.jobs.unshift(newJob);
      return newJob;
    }
  }

  public addBulkJobs(newJobs: JobPosting[]): number {
    let addedCount = 0;
    for (const job of newJobs) {
      const exists = this.jobs.some((j) => j.id === job.id || j.linkedinUrl === job.linkedinUrl);
      if (!exists) {
        this.jobs.unshift(job);
        addedCount++;
      }
    }
    return addedCount;
  }
}

// Khởi tạo Singleton Repository
export const jobRepository = new JobRepository();
