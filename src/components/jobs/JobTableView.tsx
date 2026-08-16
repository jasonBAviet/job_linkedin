"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  ExternalLink,
  ArrowUpDown,
  Building2,
  Eye,
} from "lucide-react";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";
import { JobMobileCard } from "./JobMobileCard";

interface JobTableViewProps {
  jobs: JobWithScore[];
  onSelect: (job: JobWithScore) => void;
  onTrackStatus?: (jobId: string, status: string) => void;
}

type SortField = "score" | "title" | "company" | "location" | "date" | "salary";

const PAGE_BATCH_SIZE = 12;

export const JobTableView: React.FC<JobTableViewProps> = ({
  jobs,
  onSelect,
}) => {
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_BATCH_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Sắp xếp danh sách việc làm
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
    }
    return sortOrder === "asc" ? result : -result;
  });

  // Infinite Scroll Trigger
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
      setSortOrder(field === "score" || field === "date" ? "desc" : "asc");
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Top Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-300">
            Hiển thị <span className="text-indigo-400 font-bold">{displayedJobs.length}</span> / {sortedJobs.length} việc làm Senior+ (&ge; 40 Tr / $1.6k+)
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline-block">
          Cuộn chuột tự động nạp thêm
        </span>
      </div>

      {/* Desktop & Tablet Table View */}
      <div className="hidden md:block w-full rounded-lg border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
        <div className="overflow-x-auto max-h-[calc(100vh-190px)] overflow-y-auto w-full">
          <table className="w-full text-left text-xs border-collapse font-sans">
            {/* Sticky Header */}
            <thead className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800 text-slate-300 font-semibold select-none backdrop-blur-sm">
              <tr>
                <th
                  onClick={() => handleSort("score")}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors whitespace-nowrap w-24"
                >
                  <div className="flex items-center gap-1">
                    <span>Điểm Khớp</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort("title")}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors min-w-[260px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Chức Danh & Doanh Nghiệp</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort("location")}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors whitespace-nowrap w-32"
                >
                  <div className="flex items-center gap-1">
                    <span>Khu Vực</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort("salary")}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors whitespace-nowrap w-44"
                >
                  <div className="flex items-center gap-1">
                    <span>Mức Lương</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>

                <th className="px-3 py-2.5 min-w-[200px]">
                  <span>Kỹ Năng Trọng Tâm</span>
                </th>

                <th
                  onClick={() => handleSort("date")}
                  className="px-3 py-2.5 cursor-pointer hover:bg-slate-800 transition-colors whitespace-nowrap w-24 hidden lg:table-cell"
                >
                  <div className="flex items-center gap-1">
                    <span>Ngày Đăng</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>

                <th className="px-3 py-2.5 text-right whitespace-nowrap w-28">
                  <span>Thao Tác</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {displayedJobs.map((job) => {
                const score = job.scoreResult?.totalScore || 0;
                const isDongNai = job.location === "DONG_NAI";
                const matchedSkills = job.scoreResult?.gapAnalysis?.matchedSkills || [];

                return (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-800/60 transition-colors group"
                  >
                    {/* Điểm Khớp */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <MatchScoreBadge score={score} size="sm" showLabel={false} />
                    </td>

                    {/* Chức danh & Công ty có Logo */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white border border-slate-700 overflow-hidden mt-0.5 p-0.5">
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
                            className="font-bold text-slate-100 group-hover:text-indigo-400 text-left line-clamp-1 transition-colors hover:underline text-xs"
                            title={job.title}
                          >
                            {job.title}
                          </button>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="text-slate-300 font-medium">{job.company}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-indigo-300 font-mono text-[10px]">
                              {job.seniority === "LEAD_MANAGER" ? "Lead" : "Senior"} (&ge;{job.experienceYearsRequired || 3}y)
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Khu vực */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-[11px] border ${
                          isDongNai
                            ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                            : "bg-indigo-950/60 text-indigo-300 border-indigo-800/60"
                        }`}
                      >
                        <MapPin className="h-3 w-3" />
                        {isDongNai ? "Đồng Nai" : "TP.HCM"}
                      </span>
                    </td>

                    {/* Mức Lương */}
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-emerald-400 font-bold text-xs">
                      {job.salaryRange?.display || "Thương lượng"}
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
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400 font-mono text-[11px] hidden lg:table-cell">
                      {job.postedDate}
                    </td>

                    {/* Thao tác */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSelect(job)}
                          className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-[11px] font-bold text-white transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Chi Tiết</span>
                        </button>

                        {job.linkedinUrl && (
                          <a
                            href={job.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                            title="Mở tin LinkedIn gốc"
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
          <JobMobileCard key={job.id} job={job} onSelect={onSelect} />
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
