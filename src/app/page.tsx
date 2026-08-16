"use client";

import React, { useState, useEffect, useCallback } from "react";
import { JobFilterBar } from "@/components/jobs/JobFilterBar";
import { JobTableView } from "@/components/jobs/JobTableView";
import { JobDetailModal } from "@/components/jobs/JobDetailModal";
import { JobWithScore } from "@/core/services/job-service";
import { JobSearchFilters } from "@/core/dtos/job.dto";
import { RefreshCw, AlertCircle, MapPin } from "lucide-react";

export default function HomePage() {
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);

  const [filters, setFilters] = useState<JobSearchFilters>({
    keyword: "",
    location: "ALL",
    roleCategory: "ALL",
    seniority: "SENIOR_AND_ABOVE",
    minExperienceYears: 3,
    minSalaryVND: 40000000,
    minScore: 0,
    hasSalary: false,
  });

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.location) params.set("location", filters.location);
      if (filters.roleCategory) params.set("roleCategory", filters.roleCategory);
      if (filters.seniority) params.set("seniority", filters.seniority);
      if (filters.minExperienceYears) params.set("minExperienceYears", String(filters.minExperienceYears));
      if (filters.minSalaryVND) params.set("minSalaryVND", String(filters.minSalaryVND));
      if (filters.minScore) params.set("minScore", String(filters.minScore));
      if (filters.hasSalary) params.set("hasSalary", "true");

      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
      } else {
        setError(data.message || "Không thể tải danh sách việc làm.");
      }
    } catch {
      setError("Lỗi kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleFilterChange = (newFilters: Partial<JobSearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const totalCount = jobs.length;
  const hcmCount = jobs.filter((j) => j.location === "HO_CHI_MINH").length;
  const dnCount = jobs.filter((j) => j.location === "DONG_NAI").length;
  const avgMatch =
    totalCount > 0
      ? Math.round(jobs.reduce((acc, curr) => acc + (curr.scoreResult?.totalScore || 0), 0) / totalCount)
      : 0;

  return (
    <div className="w-full px-2.5 sm:px-4 lg:px-6 py-2.5 space-y-2">
      {/* Quick Stats & Hunter Headline */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight">
            Săn Việc Senior & Lead BA / DA (&ge; 3y KN)
          </h1>
          <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-800/80 font-bold">
            Lương &gt; 40 Tr / $1.6k+
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 bg-slate-900 px-1.5 sm:px-2 py-0.5 rounded border border-slate-800 hidden sm:inline-block">
            HCM & Đồng Nai
          </span>
        </div>

        {/* Compact stats */}
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono text-slate-400">
          <div>
            Số lượng: <span className="text-white font-bold">{totalCount}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div>
            HCM: <span className="text-indigo-400 font-bold">{hcmCount}</span> / Đồng Nai:{" "}
            <span className="text-amber-400 font-bold">{dnCount}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div>
            Độ khớp TB: <span className="text-emerald-400 font-bold">{avgMatch}%</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar full width */}
      <JobFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        totalResults={jobs.length}
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded border border-rose-900/60 bg-rose-950/40 p-2 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading & Empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
          <span>Đang tính toán độ khớp năng lực với các vị trí thu nhập cao...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/50 py-12 px-4 text-center">
          <MapPin className="h-8 w-8 text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-slate-200">Không tìm thấy việc làm phù hợp</h3>
          <p className="text-xs text-slate-400 mt-1 mb-3">
            Hãy thử nới lỏng bộ lọc hoặc hạ ngưỡng điểm khớp năng lực.
          </p>
          <button
            onClick={() =>
              setFilters({
                keyword: "",
                location: "ALL",
                roleCategory: "ALL",
                seniority: "SENIOR_AND_ABOVE",
                minExperienceYears: 3,
                minSalaryVND: 40000000,
                minScore: 0,
                hasSalary: false,
              })
            }
            className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Đặt lại bộ lọc Senior (&ge; 40 Tr)
          </button>
        </div>
      ) : (
        /* Dense Full-Width Table View */
        <JobTableView
          jobs={jobs}
          onSelect={(j) => setSelectedJob(j)}
        />
      )}

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
