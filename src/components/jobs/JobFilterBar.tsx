"use client";

import React from "react";
import { Search, MapPin, Briefcase, SlidersHorizontal, DollarSign } from "lucide-react";
import { JobSearchFilters, JobRoleCategory, SeniorityLevel, WorkLocation } from "@/core/dtos/job.dto";

interface JobFilterBarProps {
  filters: JobSearchFilters;
  onFilterChange: (newFilters: Partial<JobSearchFilters>) => void;
  totalResults: number;
}

export const JobFilterBar: React.FC<JobFilterBarProps> = ({
  filters,
  onFilterChange,
  totalResults,
}) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 shadow-sm">
      {/* Inline Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-1.5">
        {/* Keyword Search */}
        <div className="relative lg:col-span-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <Search className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Tìm chức danh, công ty, kỹ năng..."
            value={filters.keyword || ""}
            onChange={(e) => onFilterChange({ keyword: e.target.value })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 pl-8 pr-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Location Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={filters.location || "ALL"}
            onChange={(e) => onFilterChange({ location: e.target.value as WorkLocation | "ALL" })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Vùng: HCM & Đồng Nai</option>
            <option value="HO_CHI_MINH">TP. Hồ Chí Minh</option>
            <option value="DONG_NAI">Đồng Nai (KCN)</option>
          </select>
        </div>

        {/* Role Category Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={filters.roleCategory || "ALL"}
            onChange={(e) => onFilterChange({ roleCategory: e.target.value as JobRoleCategory | "ALL" })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Vị trí: BA & DA</option>
            <option value="BUSINESS_ANALYST">Business Analyst (BA)</option>
            <option value="DATA_ANALYST">Data Analyst (DA)</option>
            <option value="HYBRID_BA_DA">Hybrid BA / DA</option>
          </select>
        </div>

        {/* Seniority Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={filters.seniority || "SENIOR_AND_ABOVE"}
            onChange={(e) => onFilterChange({ seniority: e.target.value as any })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs font-semibold text-indigo-400 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="SENIOR_AND_ABOVE">Senior+ (&ge;3y KN)</option>
            <option value="SENIOR">Senior (3-5y)</option>
            <option value="LEAD_MANAGER">Lead / Mgr (5y+)</option>
            <option value="ALL">Tất cả cấp bậc</option>
          </select>
        </div>

        {/* Salary Filter: > 40 Tr / >= 1600 USD */}
        <div className="lg:col-span-2">
          <select
            value={filters.minSalaryVND || 0}
            onChange={(e) => onFilterChange({ minSalaryVND: Number(e.target.value) })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value={40000000}>Lương &gt; 40Tr / $1.6k+</option>
            <option value={50000000}>Lương &gt; 50Tr / $2.0k+</option>
            <option value={0}>Mọi mức lương</option>
          </select>
        </div>

        {/* Min Score Filter */}
        <div className="lg:col-span-1">
          <select
            value={filters.minScore || 0}
            onChange={(e) => onFilterChange({ minScore: Number(e.target.value) })}
            className="w-full rounded border border-slate-700/80 bg-slate-950/80 px-1 py-1 text-[11px] text-indigo-300 focus:border-indigo-500 focus:outline-none font-mono font-bold cursor-pointer"
          >
            <option value={0}>Độ khớp</option>
            <option value={70}>&ge; 70%</option>
            <option value={85}>&ge; 85%</option>
          </select>
        </div>
      </div>
    </div>
  );
};
