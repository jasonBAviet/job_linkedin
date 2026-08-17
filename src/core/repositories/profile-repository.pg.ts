import "server-only";
import { ApplicationRecord, CandidateProfile, CandidateSkill } from "../dtos/profile.dto";
import { JobRoleCategory, SeniorityLevel, WorkLocation } from "../dtos/job.dto";
import { query } from "../db/client";

const PROFILE_ID = "candidate-primary";

/** Hồ sơ mặc định khi database chưa có bản ghi nào. */
export const INITIAL_EMPTY_PROFILE: CandidateProfile = {
  id: PROFILE_ID,
  fullName: "Dương Bá Diệu",
  targetRole: "HYBRID_BA_DA",
  currentSeniority: "SENIOR",
  preferredLocations: ["HO_CHI_MINH", "DONG_NAI"],
  expectedSalaryVND: 40000000,
  yearsOfTotalExperience: 4,
  education: "Cử nhân Quản trị Kinh doanh (BBA) - Đại học Kinh tế Đà Nẵng",
  certifications: [
    "Digital Transformation - Business Analysis & Information Systems (Coursera)",
    "Product Analytics Micro-Certification (PAC), Level 2",
    "Power BI for Data Analytics; Omnichannel Retail (RMIT University)",
    "Salesforce Operations",
    "ICPM Certified Supervisor",
  ],
  skills: [
    { name: "Requirements Engineering", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Process Modeling (BPMN/UML)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "User Story & Acceptance Criteria", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Data Mapping & ERD", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "SQL (Advanced Querying)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Power BI & DAX", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Customer Data Platform (CDP) & Customer 360", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 3 },
    { name: "Data Quality & MDM", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Python for Data Analytics", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Data Modeling & Data Warehousing", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "API Analysis & Postman", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "CRM & Omnichannel Messaging", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Power Automate & Workflow Integration", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Healthcare & Clinic Operations", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 2 },
    { name: "E-Commerce & Retail", category: "DOMAIN", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Supply Chain & Logistics", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Jira & Confluence", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Stakeholder Management", category: "SOFT_SKILL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "UAT & Solution Evaluation", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Advanced Excel", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
  ],
  rawResumeText: "",
  lastUpdated: new Date().toISOString(),
};

interface ProfileRow {
  id: string;
  full_name: string;
  target_role: string;
  current_seniority: string;
  preferred_locations: string[];
  expected_salary_vnd: number | null;
  years_of_total_experience: number;
  skills: CandidateSkill[];
  raw_resume_text: string | null;
  education: string | null;
  certifications: string[];
  last_updated: Date;
}

interface ApplicationRow {
  id: string;
  job_id: string;
  applied_date: string;
  status: string;
  match_score_at_apply: number;
  notes: string;
}

function rowToProfile(r: ProfileRow): CandidateProfile {
  return {
    id: r.id,
    fullName: r.full_name,
    targetRole: r.target_role as JobRoleCategory,
    currentSeniority: r.current_seniority as SeniorityLevel,
    preferredLocations: (r.preferred_locations || []) as WorkLocation[],
    expectedSalaryVND: r.expected_salary_vnd ?? undefined,
    yearsOfTotalExperience: Number(r.years_of_total_experience) || 0,
    skills: r.skills || [],
    rawResumeText: r.raw_resume_text ?? "",
    education: r.education ?? "",
    certifications: r.certifications || [],
    lastUpdated: r.last_updated ? r.last_updated.toISOString() : new Date().toISOString(),
  };
}

function rowToApplication(r: ApplicationRow): ApplicationRecord {
  return {
    id: r.id,
    jobId: r.job_id,
    appliedDate: r.applied_date,
    status: r.status as ApplicationRecord["status"],
    matchScoreAtApply: r.match_score_at_apply,
    notes: r.notes,
  };
}

export class ProfileRepository {
  // Profile được đọc ở MỌI request list job -> cache trong module để không
  // phải round-trip qua SSH tunnel mỗi lần.
  private cache: CandidateProfile | null = null;

  public async getProfile(): Promise<CandidateProfile> {
    if (this.cache) return { ...this.cache };

    const rows = await query<ProfileRow>(
      "SELECT * FROM candidate_profile WHERE id = $1",
      [PROFILE_ID]
    );
    if (!rows[0]) {
      // Chưa seed -> tạo bản mặc định để app dùng được ngay
      return this.updateProfile(INITIAL_EMPTY_PROFILE);
    }
    this.cache = rowToProfile(rows[0]);
    return { ...this.cache };
  }

  public async updateProfile(updated: Partial<CandidateProfile>): Promise<CandidateProfile> {
    const current = this.cache
      ? { ...this.cache }
      : (await query<ProfileRow>("SELECT * FROM candidate_profile WHERE id = $1", [PROFILE_ID]))
          .map(rowToProfile)[0] || INITIAL_EMPTY_PROFILE;

    const merged: CandidateProfile = {
      ...current,
      ...updated,
      id: PROFILE_ID,
      lastUpdated: new Date().toISOString(),
    };

    const rows = await query<ProfileRow>(
      `INSERT INTO candidate_profile
         (id, full_name, target_role, current_seniority, preferred_locations,
          expected_salary_vnd, years_of_total_experience, skills, raw_resume_text,
          education, certifications, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11, now())
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         target_role = EXCLUDED.target_role,
         current_seniority = EXCLUDED.current_seniority,
         preferred_locations = EXCLUDED.preferred_locations,
         expected_salary_vnd = EXCLUDED.expected_salary_vnd,
         years_of_total_experience = EXCLUDED.years_of_total_experience,
         skills = EXCLUDED.skills,
         raw_resume_text = EXCLUDED.raw_resume_text,
         education = EXCLUDED.education,
         certifications = EXCLUDED.certifications,
         last_updated = now()
       RETURNING *`,
      [
        merged.id,
        merged.fullName,
        merged.targetRole,
        merged.currentSeniority,
        merged.preferredLocations || [],
        merged.expectedSalaryVND ?? null,
        merged.yearsOfTotalExperience ?? 0,
        JSON.stringify(merged.skills || []),
        merged.rawResumeText ?? "",
        merged.education ?? "",
        merged.certifications || [],
      ]
    );

    this.cache = rowToProfile(rows[0]);
    return { ...this.cache };
  }

  public async getApplications(): Promise<ApplicationRecord[]> {
    const rows = await query<ApplicationRow>(
      "SELECT id, job_id, applied_date, status, match_score_at_apply, notes FROM applications ORDER BY created_at DESC"
    );
    return rows.map(rowToApplication);
  }

  public async saveOrUpdateApplication(
    record: Omit<ApplicationRecord, "id"> & { id?: string }
  ): Promise<ApplicationRecord> {
    const rows = await query<ApplicationRow>(
      `INSERT INTO applications (id, job_id, applied_date, status, match_score_at_apply, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (job_id) DO UPDATE SET
         applied_date = EXCLUDED.applied_date,
         status = EXCLUDED.status,
         match_score_at_apply = EXCLUDED.match_score_at_apply,
         notes = EXCLUDED.notes,
         updated_at = now()
       RETURNING id, job_id, applied_date, status, match_score_at_apply, notes`,
      [
        record.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        record.jobId,
        record.appliedDate || new Date().toISOString().split("T")[0],
        record.status || "SAVED",
        record.matchScoreAtApply || 0,
        record.notes || "",
      ]
    );
    return rowToApplication(rows[0]);
  }

  public async removeApplication(jobId: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      "DELETE FROM applications WHERE job_id = $1 RETURNING id",
      [jobId]
    );
    return rows.length > 0;
  }
}

export const profileRepository = new ProfileRepository();
