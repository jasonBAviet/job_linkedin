import { SkillRequirement } from "./job.dto";

export interface SkillMatchDetail {
  skillName: string;
  category: string;
  importance: "MUST_HAVE" | "GOOD_TO_HAVE";
  isMatched: boolean;
  candidateProficiency?: number;
  weight: number;
}

export interface ScoreBreakdown {
  coreSkillsScore: number; // Max 50
  secondarySkillsScore: number; // Max 20
  seniorityScore: number; // Max 15
  locationScore: number; // Max 10
  certificationScore: number; // Max 5
  totalScore: number; // 0 - 100
}

export interface RadarMetric {
  subject: string;
  required: number; // 0 - 100
  candidate: number; // 0 - 100
  fullMark: number;
}

export interface GapAnalysisResult {
  matchedSkills: string[];
  missingMustHaveSkills: SkillRequirement[];
  missingGoodToHaveSkills: SkillRequirement[];
  strongestAreas: string[];
  improvementSuggestions: string[];
  interviewPrepTips: string[];
}

export interface JobMatchScoreResult {
  jobId: string;
  totalScore: number; // 0 - 100
  scoreTier: "PERFECT_MATCH" | "HIGH_MATCH" | "MODERATE_MATCH" | "LOW_MATCH";
  breakdown: ScoreBreakdown;
  radarData: RadarMetric[];
  gapAnalysis: GapAnalysisResult;
  skillDetails: SkillMatchDetail[];
}
