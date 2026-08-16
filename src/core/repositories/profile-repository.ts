import { ApplicationRecord, CandidateProfile } from "../dtos/profile.dto";

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  id: "candidate-default-01",
  fullName: "Nguyễn Thành Đạt (Senior BA/DA)",
  targetRole: "BUSINESS_ANALYST",
  currentSeniority: "SENIOR",
  preferredLocations: ["HO_CHI_MINH", "DONG_NAI"],
  expectedSalaryVND: 42000000,
  yearsOfTotalExperience: 4.5,
  education: "Cử nhân Hệ thống Thông tin Quản lý (MIS) - Đại học Quốc gia TP.HCM",
  certifications: [
    "Certified Capability in Business Analysis (CCBA - IIBA)",
    "Professional Scrum Product Owner (PSPO I)",
    "Microsoft Certified: Power BI Data Analyst Associate",
  ],
  skills: [
    { name: "Requirements Engineering", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Process Modeling (BPMN/UML)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "User Story & Acceptance Criteria", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "SQL (Advanced Querying)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Power BI & DAX", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Data Modeling & Data Warehousing", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Jira & Confluence", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "API Analysis & Postman", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Stakeholder Management", category: "SOFT_SKILL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "UAT & Solution Evaluation", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Supply Chain & Logistics", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Fintech & Banking", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Statistical Analysis & A/B Testing", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
  ],
  rawResumeText: `Senior Business Analyst & Data Specialist với hơn 4.5 năm kinh nghiệm thực chiến trong việc phân tích yêu cầu phần mềm phức tạp, thiết kế kiến trúc quy trình nghiệp vụ (BPMN 2.0), soạn thảo tài liệu đặc tả chuẩn BABOK (BRD, SRS, User Stories) và quản trị dự án Agile/Scrum. Thành thạo truy vấn SQL nâng cao, mô hình hóa dữ liệu (Star Schema, DWH) và trực quan hóa báo cáo với Power BI cho các tập đoàn tại TP.HCM và khu vực nhà máy/kho vận Đồng Nai.`,
  lastUpdated: new Date().toISOString(),
};

export class ProfileRepository {
  private currentProfile: CandidateProfile;
  private applications: ApplicationRecord[];

  constructor() {
    this.currentProfile = { ...DEFAULT_CANDIDATE_PROFILE };
    this.applications = [
      {
        id: "app-01",
        jobId: "job-ba-hcm-01",
        appliedDate: "2026-08-15",
        status: "INTERVIEW",
        matchScoreAtApply: 88,
        notes: "Đã vượt qua vòng phỏng vấn kỹ thuật, đang chờ lịch phỏng vấn với Giám đốc khối sản phẩm.",
      },
      {
        id: "app-02",
        jobId: "job-ba-dn-03",
        appliedDate: "2026-08-14",
        status: "SCREENING",
        matchScoreAtApply: 82,
        notes: "Đã gửi CV qua LinkedIn, nhân sự đã xem hồ sơ.",
      },
    ];
  }

  public getProfile(): CandidateProfile {
    return { ...this.currentProfile };
  }

  public updateProfile(updated: Partial<CandidateProfile>): CandidateProfile {
    this.currentProfile = {
      ...this.currentProfile,
      ...updated,
      lastUpdated: new Date().toISOString(),
    };
    return { ...this.currentProfile };
  }

  public getApplications(): ApplicationRecord[] {
    return [...this.applications];
  }

  public saveOrUpdateApplication(record: Omit<ApplicationRecord, "id"> & { id?: string }): ApplicationRecord {
    const existingIndex = this.applications.findIndex((a) => a.jobId === record.jobId);
    if (existingIndex >= 0) {
      this.applications[existingIndex] = {
        ...this.applications[existingIndex],
        ...record,
      };
      return this.applications[existingIndex];
    } else {
      const newRecord: ApplicationRecord = {
        id: record.id || `app-${Date.now()}`,
        jobId: record.jobId,
        appliedDate: record.appliedDate || new Date().toISOString().split("T")[0],
        status: record.status || "SAVED",
        matchScoreAtApply: record.matchScoreAtApply || 0,
        notes: record.notes || "",
      };
      this.applications.unshift(newRecord);
      return newRecord;
    }
  }

  public removeApplication(jobId: string): boolean {
    const initialLength = this.applications.length;
    this.applications = this.applications.filter((a) => a.jobId !== jobId);
    return this.applications.length < initialLength;
  }
}

export const profileRepository = new ProfileRepository();
