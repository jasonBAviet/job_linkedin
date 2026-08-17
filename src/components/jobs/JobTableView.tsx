"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  ExternalLink,
  ArrowUpDown,
  Building2,
  Eye,
  Zap,
  Users,
  Flame,
  Clock,
} from "lucide-react";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";
import { JobUserStatus, SeniorityLevel } from "@/core/dtos/job.dto";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";
import { CompetitionBadge } from "./CompetitionBadge";
import { JobMobileCard } from "./JobMobileCard";
import { JobStatusActions } from "./JobStatusActions";

interface JobTableViewProps {
  jobs: JobWithScore[];
  onSelect: (job: JobWithScore) => void;
  onTrackStatus?: (jobId: string, status: string) => void;
  onStatusChange?: (jobId: string, status: JobUserStatus) => void;
}

type SortField = "score" | "title" | "company" | "location" | "date" | "salary" | "competition" | "crawledAt";

const PAGE_BATCH_SIZE = 12;

const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  INTERN: "Thực tập",
  FRESHER: "Fresher",
  JUNIOR: "Junior",
  MIDDLE: "Middle",
  SENIOR: "Senior",
  LEAD_MANAGER: "Lead / Manager",
};

function formatDateTime(isoOrStr?: string): string {
  if (!isoOrStr) return "Mới cào";
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return isoOrStr;
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${day}/${month} ${hours}:${mins}`;
  } catch {
    return isoOrStr;
  }
}

const TABLE_COLUMNS: { field?: SortField; label: string; width: string; align?: string }[] = [
  { field: "score", label: "Điểm Khớp", width: "w-24" },
  { field: "title", label: "Chức Danh & Dạng Nộp", width: "min-w-[260px]" },
  { field: "location", label: "Khu Vực & Hình Thức", width: "w-32" },
  { field: "salary", label: "Mức Lương", width: "w-36" },
  { field: "competition", label: "Cạnh Tranh & Ứng Viên", width: "w-36" },
  { label: "Kỹ Năng Trọng Tâm", width: "min-w-[180px]" },
  { field: "date", label: "Ngày Đăng", width: "w-24" },
  { field: "crawledAt", label: "Ngày Giờ Cào", width: "w-32" },
  { label: "Thao Tác", width: "w-28", align: "text-right" },
];

export const JobTableView: React.FC<JobTableViewProps> = ({
  jobs,
  onSelect,
  onStatusChange,
}) => {
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_BATCH_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

  const sortedJobs = [...jobs].sort((a, b) => {
    let result = 0;
    if (sortField === "score") {
      result = (a.scoreResult?.totalScore || 0) - (b.scoreResult?.totalScore || 0);
    } else if (sortField === "title") {
      result = a.title.localeCompare(b.title);
    } else if (sortField === "company") {
      result = a.company.localeCompare(b.company);
    } else if (sortField === "location") {
      result = a.location.localeCompare(b.location);
    } else if (sortField === "date") {
      result = a.postedDate.localeCompare(b.postedDate);
    } else if (sortField === "salary") {
      const getVnd = (j: JobWithScore) => {
        if (!j.salaryRange?.min) return 0;
        return j.salaryRange.currency === "USD" ? j.salaryRange.min * 25400 : j.salaryRange.min;
      };
      result = getVnd(a) - getVnd(b);
    } else if (sortField === "competition") {
      const getCompRank = (j: JobWithScore) => {
        if (j.competitionLevel === "LOW") return 1;
        if (j.competitionLevel === "MEDIUM") return 2;
        if (j.competitionLevel === "HIGH") return 3;
        return 0;
      };
      result = getCompRank(a) - getCompRank(b);
    } else if (sortField === "crawledAt") {
      result = (a.crawledAt || "").localeCompare(b.crawledAt || "");
    }
    return sortOrder === "asc" ? result : -result;
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < sortedJobs.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_BATCH_SIZE, sortedJobs.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, sortedJobs.length]);

  useEffect(() => {
    setVisibleCount(PAGE_BATCH_SIZE);
  }, [jobs.length, sortField, sortOrder]);

  const displayedJobs = sortedJobs.slice(0, visibleCount);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "score" || field === "date" || field === "competition" || field === "crawledAt" ? "desc" : "asc");
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-300">
            Hiển thị <span className="text-indigo-400 font-bold">{displayedJobs.length}</span> / {sortedJobs.length} việc làm thực tế
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline-block">
          Bảng hỗ trợ cuộn ngang &amp; cuộn dọc nạp thêm
        </span>
      </div>

      {/* Desktop & Tablet Table View */}
      <div className="hidden md:block w-full rounded-lg border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
        <div className="overflow-x-auto max-h-[calc(100vh-190px)] overflow-y-auto w-full">
          <table className="w-full text-left text-xs border-collapse font-sans min-w-[1100px]">
            <thead className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800 text-slate-300 font-semibold select-none backdrop-blur-sm">
              <tr>
                {TABLE_COLUMNS.map((col, idx) => (
                  <th
                    key={idx}
                    onClick={() => col.field && handleSort(col.field)}
                    className={`px-3 py-2.5 whitespace-nowrap ${col.width} ${col.align || ""} ${
                      col.field ? "cursor-pointer hover:bg-slate-800 transition-colors" : ""
                    }`}
                  >
                    <div className={`flex items-center gap-1 ${col.align === "text-right" ? "justify-end" : ""}`}>
                      <span>{col.label}</span>
                      {col.field && <ArrowUpDown className="h-3 w-3 text-slate-500" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {displayedJobs.map((job) => {
                const score = job.scoreResult?.totalScore || 0;
                const isDongNai = job.location === "DONG_NAI";
                const isEasyApply = job.isEasyApply || job.applyType === "EASY_APPLY";
                const matchedSkills = job.scoreResult?.gapAnalysis?.matchedSkills || [];
                const jobStatus = job.userStatus || "NEW";
                const isSeniorityInferred = (job.inferredFields || []).includes("seniority");

                const rowBorderClass =
                  jobStatus === "SAVED"
                    ? "border-l-2 border-l-amber-500"
                    : jobStatus === "VIEWED"
                    ? "opacity-75"
                    : "";

                return (
                  <tr
                    key={job.id}
                    className={`hover:bg-slate-800/60 transition-colors group ${rowBorderClass}`}
                  >
                    {/* Điểm Khớp */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <MatchScoreBadge
                        score={score}
                        size="sm"
                        showLabel={false}
                        evidenceLevel={job.scoreResult?.evidence?.level}
                      />
                    </td>

                    {/* Chức danh & Doanh nghiệp & Dạng nộp */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white overflow-hidden mt-0.5 p-0.5">
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

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => onSelect(job)}
                              className="font-bold text-slate-100 group-hover:text-indigo-400 text-left line-clamp-1 transition-colors hover:underline text-xs"
                              title={job.title}
                            >
                              {job.title}
                            </button>

                            {/* Easy Apply Badge */}
                            {isEasyApply && (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-[#0A66C2]/20 text-[#38BDF8] border border-[#0A66C2]/60 shrink-0">
                                in Easy Apply
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="text-slate-300 font-medium">{job.company}</span>
                            <span className="text-slate-600">•</span>
                            <span
                              className={`font-mono text-[10px] ${
                                isSeniorityInferred ? "text-slate-500 italic" : "text-indigo-300"
                              }`}
                              title={
                                isSeniorityInferred
                                  ? "Cấp bậc do hệ thống suy đoán, tin tuyển dụng không nêu rõ"
                                  : undefined
                              }
                            >
                              {SENIORITY_LABELS[job.seniority] ?? job.seniority}
                              {isSeniorityInferred ? " (suy đoán)" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Khu vực & Hình thức (On-site/Hybrid/Remote) */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-[10px] border w-fit ${
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
                    </td>

                    {/* Mức Lương */}
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-emerald-400 font-bold text-xs">
                      {job.salaryRange?.display || "Không công bố"}
                    </td>

                    {/* Cạnh Tranh & Số Ứng Viên */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <CompetitionBadge
                        competitionLevel={job.competitionLevel}
                        applicantCountText={job.applicantCountText}
                        isPromoted={job.isPromoted}
                        responsesManagedOffLinkedIn={job.responsesManagedOffLinkedIn}
                      />
                    </td>

                    {/* Kỹ Năng */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {job.extractedSkills.slice(0, 3).map((skill, idx) => {
                          const isMatch = matchedSkills.includes(skill.name);
                          return (
                            <span
                              key={idx}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                                isMatch
                                  ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/70 font-semibold"
                                  : "bg-slate-800 text-slate-400 border border-slate-700/60"
                              }`}
                            >
                              {isMatch && <span className="mr-0.5 text-emerald-400">✓</span>}
                              {skill.name}
                            </span>
                          );
                        })}
                        {job.extractedSkills.length > 3 && (
                          <span className="text-[10px] text-slate-500 font-mono self-center">
                            +{job.extractedSkills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Ngày đăng */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {job.postedDate}
                    </td>

                    {/* Ngày giờ cào */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-indigo-400 shrink-0" />
                        <span>{formatDateTime(job.crawledAt)}</span>
                      </div>
                    </td>

                    {/* Thao tac */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onStatusChange && (
                          <JobStatusActions
                            jobId={job.id}
                            currentStatus={jobStatus}
                            onStatusChange={onStatusChange}
                            size="sm"
                          />
                        )}

                        <button
                          onClick={() => onSelect(job)}
                          className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Chi Tiet</span>
                        </button>

                        {job.linkedinUrl && (
                          <a
                            href={job.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                            title="Mo tin LinkedIn goc"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="block md:hidden w-full space-y-2">
        {displayedJobs.map((job) => (
          <JobMobileCard
            key={job.id}
            job={job}
            onSelect={onSelect}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {/* Infinite Scroll sentinel */}
      <div ref={observerTarget} className="py-2 text-center text-slate-600 text-[11px]">
        {visibleCount < sortedJobs.length ? (
          <span className="text-slate-400 animate-pulse">Đang tải thêm việc làm khi cuộn...</span>
        ) : (
          <span>Đã tải toàn bộ {sortedJobs.length} việc làm.</span>
        )}
      </div>
    </div>
  );
};
