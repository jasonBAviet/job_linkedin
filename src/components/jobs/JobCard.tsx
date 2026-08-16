"use client";

import React from "react";
import { MapPin, DollarSign, ExternalLink, ArrowRight, Building2, Check, Bookmark } from "lucide-react";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";

interface JobCardProps {
  job: JobWithScore;
  onSelect: (job: JobWithScore) => void;
  onSaveToggle?: (jobId: string) => void;
  isSaved?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onSelect,
  onSaveToggle,
  isSaved = false,
}) => {
  const isDongNai = job.location === "DONG_NAI";
  const score = job.scoreResult?.totalScore || 0;

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            {/* Company Avatar / Logo */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 overflow-hidden text-slate-700 font-bold text-base p-1.5 shadow-2xs">
              {job.companyLogo ? (
                <img
                  src={job.companyLogo}
                  alt={job.company}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <Building2 className="h-6 w-6 text-slate-400" />
              )}
            </div>

            {/* Title & Company */}
            <div>
              <h3
                onClick={() => onSelect(job)}
                className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer line-clamp-1"
                title={job.title}
              >
                {job.title}
              </h3>
              <p className="text-xs font-medium text-slate-600 line-clamp-1 mt-0.5">
                {job.company}
              </p>
            </div>
          </div>

          {/* Match Score Badge */}
          <div className="shrink-0">
            <MatchScoreBadge score={score} size="md" showLabel={false} />
          </div>
        </div>

        {/* Badges: Location, Seniority, Salary */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {/* Location Badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium ${
              isDongNai
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-indigo-50 text-indigo-800 border border-indigo-200"
            }`}
          >
            <MapPin className="h-3 w-3" />
            {isDongNai ? "Đồng Nai" : "TP. Hồ Chí Minh"}
          </span>

          {/* Role Category */}
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {job.roleCategory === "BUSINESS_ANALYST"
              ? "Business Analyst"
              : job.roleCategory === "DATA_ANALYST"
              ? "Data Analyst"
              : "Hybrid BA & DA"}
          </span>

          {/* Salary */}
          {job.salaryRange && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 border border-emerald-200">
              <DollarSign className="h-3 w-3" />
              {job.salaryRange.display}
            </span>
          )}

          {/* Work mode */}
          <span className="text-[11px] text-slate-500">
            {job.workMode === "HYBRID" ? "Hybrid (Linh hoạt)" : job.workMode === "REMOTE" ? "Remote" : "Tại văn phòng"}
          </span>
        </div>

        {/* Extracted Skills Preview */}
        <div className="mt-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Kỹ năng yêu cầu trọng tâm:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {job.extractedSkills.slice(0, 5).map((skill, idx) => {
              const isMatched = job.scoreResult?.gapAnalysis?.matchedSkills?.includes(skill.name);
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                    isMatched
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                      : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  {isMatched && <Check className="h-2.5 w-2.5 text-emerald-600" />}
                  {skill.name}
                </span>
              );
            })}
            {job.extractedSkills.length > 5 && (
              <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-400">
                +{job.extractedSkills.length - 5}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="text-[11px] text-slate-400">
          Đăng ngày: {job.postedDate}
        </div>

        <div className="flex items-center gap-2">
          {job.linkedinUrl && (
            <a
              href={job.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              title="Mở tin tuyển dụng gốc trên LinkedIn"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">LinkedIn</span>
            </a>
          )}

          <button
            onClick={() => onSelect(job)}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
          >
            <span>Phân Tích Chi Tiết</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
