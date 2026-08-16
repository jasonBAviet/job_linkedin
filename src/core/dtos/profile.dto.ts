import { JobRoleCategory, SeniorityLevel, WorkLocation } from "./job.dto";

export interface CandidateSkill {
  name: string;
  category: "CORE" | "SECONDARY" | "TOOL" | "DOMAIN" | "SOFT_SKILL";
  proficiencyLevel: 1 | 2 | 3 | 4 | 5; // 1: Beginner, 2: Elementary, 3: Intermediate, 4: Advanced, 5: Expert
  yearsOfExperience: number;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  targetRole: JobRoleCategory;
  currentSeniority: SeniorityLevel;
  preferredLocations: WorkLocation[];
  expectedSalaryVND?: number;
  yearsOfTotalExperience: number;
  skills: CandidateSkill[];
  rawResumeText?: string;
  education?: string;
  certifications?: string[];
  lastUpdated: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  appliedDate: string;
  status: "SAVED" | "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "REJECTED";
  matchScoreAtApply: number;
  notes?: string;
}
