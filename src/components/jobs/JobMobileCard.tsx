"use client";

import React from "react";
import { MapPin, ExternalLink, Building2, Eye, Clock } from "lucide-react";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";
import { JobUserStatus } from "@/core/dtos/job.dto";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";
import { CompetitionBadge } from "./CompetitionBadge";
import { JobStatusActions } from "./JobStatusActions";

function formatDateTime(isoOrStr?: string): string {
  if (!isoOrStr) return "";
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return isoOrStr;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoOrStr;
  }
}

interface JobMobileCardProps {
  job: JobWithScore;
  onSelect: (job: JobWithScore) => void;
  onStatusChange?: (jobId: string, status: JobUserStatus) => void;
}

export const JobMobileCard: React.FC<JobMobileCardProps> = ({ job, onSelect, onStatusChange }) => {
  const score = job.scoreResult?.totalScore || 0;
  const isDongNai = job.location === "DONG_NAI";
  const isEasyApply = job.isEasyApply || job.applyType === "EASY_APPLY";
  const matchedSkills = job.scoreResult?.gapAnalysis?.matchedSkills || [];

  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2 shadow-sm">
      {/* Header: Score + Title + Company + Easy Apply */}
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white overflow-hidden p-0.5">
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
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => onSelect(job)}
                className="font-bold text-slate-100 text-left line-clamp-1 hover:text-indigo-400 text-xs"
              >
                {job.title}
              </button>
              {isEasyApply && (
                <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-[#0A66C2]/20 text-[#38BDF8] border border-[#0A66C2]/60 shrink-0">
                  in Easy Apply
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate">{job.company}</p>
          </div>
        </div>

        <MatchScoreBadge score={score} size="sm" showLabel={false} />
      </div>

      {/* Location, WorkMode, Salary & Competition */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1">
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

          <span className="text-[10px] text-slate-400 font-mono">
            {job.workMode === "ON_SITE" ? "On-site" : job.workMode === "REMOTE" ? "Remote" : "Hybrid"}
          </span>
        </div>

        <span className="font-mono font-bold text-emerald-400 text-xs">
          {job.salaryRange?.display || "Không công bố"}
        </span>
      </div>

      {/* Competition & Applicant Info */}
      <div className="flex items-center justify-between text-xs">
        <CompetitionBadge
          competitionLevel={job.competitionLevel}
          applicantCountText={job.applicantCountText}
          isPromoted={job.isPromoted}
          responsesManagedOffLinkedIn={job.responsesManagedOffLinkedIn}
          size="sm"
        />
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <span>{job.postedDate}</span>
          {job.crawledAt && (
            <span className="flex items-center gap-0.5 text-indigo-300">
              <Clock className="h-2.5 w-2.5 text-indigo-400" />
              {formatDateTime(job.crawledAt)}
            </span>
          )}
        </div>
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
        {onStatusChange && (
          <JobStatusActions
            jobId={job.id}
            currentStatus={job.userStatus || "NEW"}
            onStatusChange={onStatusChange}
            size="md"
          />
        )}

        <button
          onClick={() => onSelect(job)}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 py-1.5 text-xs font-bold text-white transition-colors"
        >
          <Eye className="h-3 w-3" />
          <span>Chi Tiet</span>
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
