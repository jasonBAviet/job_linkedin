"use client";

import React from "react";
import { MapPin, ExternalLink, Building2, Eye } from "lucide-react";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";

interface JobMobileCardProps {
  job: JobWithScore;
  onSelect: (job: JobWithScore) => void;
}

export const JobMobileCard: React.FC<JobMobileCardProps> = ({ job, onSelect }) => {
  const score = job.scoreResult?.totalScore || 0;
  const isDongNai = job.location === "DONG_NAI";
  const matchedSkills = job.scoreResult?.gapAnalysis?.matchedSkills || [];

  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2 shadow-sm">
      {/* Header: Score + Title + Company */}
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white border border-slate-700 overflow-hidden p-0.5">
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
              <Building2 className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <button
              onClick={() => onSelect(job)}
              className="font-bold text-slate-100 text-left line-clamp-1 hover:text-indigo-400 text-xs"
            >
              {job.title}
            </button>
            <p className="text-[11px] text-slate-400 font-medium truncate">{job.company}</p>
          </div>
        </div>

        <MatchScoreBadge score={score} size="sm" showLabel={false} />
      </div>

      {/* Location & Salary */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-[10px] border ${
            isDongNai
              ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
              : "bg-indigo-950/60 text-indigo-300 border-indigo-800/60"
          }`}
        >
          <MapPin className="h-2.5 w-2.5" />
          {isDongNai ? "Đồng Nai" : "TP.HCM"}
        </span>

        <span className="font-mono font-bold text-emerald-400 text-xs">
          {job.salaryRange?.display || "Thương lượng"}
        </span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1">
        {job.extractedSkills.slice(0, 3).map((skill, idx) => {
          const isMatch = matchedSkills.includes(skill.name);
          return (
            <span
              key={idx}
              className={`rounded px-1.5 py-0.5 text-[9px] font-mono ${
                isMatch
                  ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/70"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {isMatch && "✓ "}
              {skill.name}
            </span>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSelect(job)}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 py-1.5 text-xs font-bold text-white transition-colors"
        >
          <Eye className="h-3 w-3" />
          <span>Chi Tiết & Phân Tích</span>
        </button>
        {job.linkedinUrl && (
          <a
            href={job.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-indigo-400 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
