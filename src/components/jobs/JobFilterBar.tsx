"use client";

import React, { useState } from "react";
import { Search, ChevronDown, RotateCcw, SlidersHorizontal, Bookmark } from "lucide-react";
import {
  JobSearchFilters,
  JobRoleCategory,
  SeniorityLevel,
  WorkLocation,
  WorkMode,
  DatePostedFilter,
  JobUserStatus,
} from "@/core/dtos/job.dto";

interface JobFilterBarProps {
  filters: JobSearchFilters;
  onFilterChange: (newFilters: Partial<JobSearchFilters>) => void;
  totalResults: number;
  statusCounts?: Record<JobUserStatus, number>;
}

export const JobFilterBar: React.FC<JobFilterBarProps> = ({
  filters,
  onFilterChange,
  totalResults,
  statusCounts,
}) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const isEasyApplyActive = !!filters.isEasyApply || filters.applyType === "EASY_APPLY";

  const handleResetFilters = () => {
    onFilterChange({
      keyword: "",
      company: "",
      location: "ALL",
      roleCategory: "ALL",
      seniority: "ALL",
      datePosted: "ALL",
      workMode: "ALL",
      applyType: "ALL",
      isEasyApply: false,
      competitionLevel: "ALL",
      minExperienceYears: 0,
      minSalaryVND: 0,
      minScore: 0,
      hasSalary: false,
      userStatus: "ALL",
    });
  };

  const hasActiveFilter =
    Boolean(filters.keyword) ||
    Boolean(filters.company) ||
    filters.location !== "ALL" ||
    filters.roleCategory !== "ALL" ||
    filters.seniority !== "ALL" ||
    filters.datePosted !== "ALL" ||
    filters.workMode !== "ALL" ||
    (filters.competitionLevel && filters.competitionLevel !== "ALL") ||
    isEasyApplyActive ||
    (filters.minSalaryVND || 0) > 0 ||
    (filters.minScore || 0) > 0 ||
    (filters.userStatus && filters.userStatus !== "ALL");

  return (
    <div className="space-y-2">
      {/* LinkedIn Style Pill Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-md backdrop-blur-sm">
        {/* 1. Keyword Search Input */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <Search className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo chức danh, kỹ năng..."
            value={filters.keyword || ""}
            onChange={(e) => onFilterChange({ keyword: e.target.value })}
            className="w-full rounded-full border border-slate-700/80 bg-slate-950/90 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* 2. Jobs (Vị trí / Role Category) Pill */}
        <div className="relative">
          <select
            value={filters.roleCategory || "ALL"}
            onChange={(e) => onFilterChange({ roleCategory: e.target.value as JobRoleCategory | "ALL" })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.roleCategory && filters.roleCategory !== "ALL"
                ? "border-emerald-600 bg-emerald-950/80 text-emerald-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Vị trí: Tất cả</option>
            <option value="BUSINESS_ANALYST">Business Analyst (BA)</option>
            <option value="DATA_ANALYST">Data Analyst (DA)</option>
            <option value="HYBRID_BA_DA">Hybrid BA / DA</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 3. Date posted (Ngày đăng) Pill */}
        <div className="relative">
          <select
            value={filters.datePosted || "ALL"}
            onChange={(e) => onFilterChange({ datePosted: e.target.value as DatePostedFilter })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.datePosted && filters.datePosted !== "ALL"
                ? "border-emerald-600 bg-emerald-950/80 text-emerald-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Ngày đăng: Mọi lúc</option>
            <option value="PAST_24H">24 giờ qua</option>
            <option value="PAST_WEEK">1 tuần qua</option>
            <option value="PAST_MONTH">1 tháng qua</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 4. Experience level (Cấp bậc kinh nghiệm) Pill */}
        <div className="relative">
          <select
            value={filters.seniority || "ALL"}
            onChange={(e) => onFilterChange({ seniority: e.target.value as any })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.seniority && filters.seniority !== "ALL"
                ? "border-indigo-500 bg-indigo-950/80 text-indigo-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Cấp bậc: Tất cả</option>
            <option value="SENIOR_AND_ABOVE">Senior+ (≥3y KN)</option>
            <option value="SENIOR">Senior (3-5y)</option>
            <option value="LEAD_MANAGER">Lead / Manager (5y+)</option>
            <option value="MIDDLE">Middle</option>
            <option value="JUNIOR">Junior / Fresher</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 5. Company Input Pill */}
        <div className="relative min-w-[130px] max-w-[170px]">
          <input
            type="text"
            placeholder="Lọc công ty..."
            value={filters.company || ""}
            onChange={(e) => onFilterChange({ company: e.target.value })}
            className="w-full rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* 6. Remote / Work Mode Pill */}
        <div className="relative">
          <select
            value={filters.workMode || "ALL"}
            onChange={(e) => onFilterChange({ workMode: e.target.value as WorkMode | "ALL" })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.workMode && filters.workMode !== "ALL"
                ? "border-emerald-600 bg-emerald-950/80 text-emerald-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Hình thức: Tất cả</option>
            <option value="ON_SITE">On-site (Tại văn phòng)</option>
            <option value="HYBRID">Hybrid (Linh hoạt)</option>
            <option value="REMOTE">Remote (Từ xa)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 7. Competition Level Pill */}
        <div className="relative">
          <select
            value={filters.competitionLevel || "ALL"}
            onChange={(e) => onFilterChange({ competitionLevel: e.target.value as any })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.competitionLevel && filters.competitionLevel !== "ALL"
                ? "border-amber-600 bg-amber-950/80 text-amber-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Cạnh tranh: Tất cả</option>
            <option value="LOW">Ít cạnh tranh (&lt;25)</option>
            <option value="MEDIUM">Cạnh tranh vừa (25-100)</option>
            <option value="HIGH">Cạnh tranh cao (&gt;100)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 8. Easy Apply Pill Toggle (LinkedIn Icon Style) */}
        <button
          type="button"
          onClick={() => {
            if (isEasyApplyActive) {
              onFilterChange({ isEasyApply: false, applyType: "ALL" });
            } else {
              onFilterChange({ isEasyApply: true, applyType: "EASY_APPLY" });
            }
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
            isEasyApplyActive
              ? "bg-[#0A66C2] text-white border-[#0A66C2] shadow-[#0A66C2]/30 ring-2 ring-[#0A66C2]/40"
              : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
          }`}
        >
          <span className="font-serif font-black text-[11px] leading-none">in</span>
          <span>Easy Apply</span>
        </button>

        {/* Status Filter Pill (Luu/Da xem/An) */}
        <div className="relative">
          <select
            value={filters.userStatus || "ALL"}
            onChange={(e) => onFilterChange({ userStatus: e.target.value as JobUserStatus | "ALL" })}
            className={`appearance-none rounded-full border pl-3 pr-7 py-1.5 text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
              filters.userStatus && filters.userStatus !== "ALL"
                ? "border-amber-600 bg-amber-950/80 text-amber-300 shadow-sm"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <option value="ALL">Trang thai: Tat ca</option>
            <option value="SAVED">Da luu{statusCounts?.SAVED ? ` (${statusCounts.SAVED})` : ""}</option>
            <option value="VIEWED">Da xem{statusCounts?.VIEWED ? ` (${statusCounts.VIEWED})` : ""}</option>
            <option value="HIDDEN">Da an{statusCounts?.HIDDEN ? ` (${statusCounts.HIDDEN})` : ""}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* 8. All Filters Button */}
        <button
          type="button"
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
            showMoreFilters || (filters.minSalaryVND || 0) > 0 || (filters.minScore || 0) > 0
              ? "bg-indigo-950/80 text-indigo-300 border-indigo-500"
              : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
          }`}
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Tất cả bộ lọc</span>
        </button>

        {/* 9. Reset Button (Only when filter active) */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors flex items-center gap-1 cursor-pointer"
            title="Đặt lại toàn bộ bộ lọc"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* Expanded Filters Drawer (Salary & Score) */}
      {showMoreFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs">
          {/* Location Area */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Khu vực:</span>
            <select
              value={filters.location || "ALL"}
              onChange={(e) => onFilterChange({ location: e.target.value as WorkLocation | "ALL" })}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Vùng: HCM & Đồng Nai</option>
              <option value="HO_CHI_MINH">TP. Hồ Chí Minh</option>
              <option value="DONG_NAI">Đồng Nai (KCN)</option>
            </select>
          </div>

          {/* Salary Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Mức lương tối thiểu:</span>
            <select
              value={filters.minSalaryVND || 0}
              onChange={(e) => onFilterChange({ minSalaryVND: Number(e.target.value) })}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value={0}>Mọi mức lương</option>
              <option value={40000000}>≥ 40 Triệu / $1.6k+</option>
              <option value={50000000}>≥ 50 Triệu / $2.0k+</option>
            </select>
          </div>

          {/* Match Score Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Độ khớp CV:</span>
            <select
              value={filters.minScore || 0}
              onChange={(e) => onFilterChange({ minScore: Number(e.target.value) })}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value={0}>Tất cả điểm số</option>
              <option value={70}>≥ 70% (Khớp tốt)</option>
              <option value={85}>≥ 85% (Khớp xuất sắc)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
