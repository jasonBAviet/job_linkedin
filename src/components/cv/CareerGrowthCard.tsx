"use client";

import React from "react";
import { TrendingUp, ArrowUpRight, ShieldAlert, Sparkles, Building2, MapPin, DollarSign, Eye } from "lucide-react";
import { CareerGrowthJob } from "@/core/services/cv-matcher-service";
import { JobWithScore } from "@/core/services/job-service";

interface CareerGrowthCardProps {
  growthItem: CareerGrowthJob;
  onSelect: (job: JobWithScore) => void;
}

export const CareerGrowthCard: React.FC<CareerGrowthCardProps> = ({ growthItem, onSelect }) => {
  const { job, readinessScore, salaryUpside, bridgeSkills, progressionType, growthPotentialReasons } = growthItem;
  const isDongNai = job.location === "DONG_NAI";

  const getProgressionBadge = () => {
    switch (progressionType) {
      case "UPGRADE_SENIORITY":
        return { label: "Nâng Cấp Cấp Bậc (Lead/Manager)", color: "bg-purple-950/80 text-purple-300 border-purple-800" };
      case "CROSS_EXPANSION_HYBRID":
        return { label: "Mở Rộng Kỹ Năng (Hybrid BA/DA)", color: "bg-blue-950/80 text-blue-300 border-blue-800" };
      case "HIGH_SALARY_LEAP":
        return { label: "Đột Phá Thu Nhập (> 50-75 Tr)", color: "bg-emerald-950/80 text-emerald-300 border-emerald-800" };
    }
  };

  const badge = getProgressionBadge();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3.5 space-y-3 shadow-md hover:border-indigo-500/50 transition-all">
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white border border-slate-700 overflow-hidden mt-0.5 p-0.5">
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
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border mb-1 ${badge.color}`}>
              {badge.label}
            </span>
            <h3 className="text-xs font-bold text-slate-100 line-clamp-1">{job.title}</h3>
            <p className="text-[11px] text-slate-400 font-medium">{job.company}</p>
          </div>
        </div>

        {/* Readiness Pill */}
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-slate-400">Độ sẵn sàng:</div>
          <div className="text-sm font-mono font-black text-indigo-400 bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-800/80">
            {readinessScore}%
          </div>
        </div>
      </div>

      {/* Salary & Location */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 font-mono">
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

        <span className="font-bold text-emerald-400 text-xs">
          {salaryUpside}
        </span>
      </div>

      {/* Bridge Skills Need to Upgrade */}
      <div className="rounded bg-slate-950/80 p-2.5 border border-slate-800 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400">
          <Sparkles className="h-3 w-3" />
          <span>Kỹ năng cầu nối cần bổ sung (Bridge Skills):</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {bridgeSkills.map((s, idx) => (
            <span
              key={idx}
              className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-800/60"
            >
              + {s}
            </span>
          ))}
        </div>
      </div>

      {/* Action button */}
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={() => onSelect(job as any)}
          className="w-full flex items-center justify-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 py-1.5 text-xs font-bold text-white transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Xem Lộ Trình Nâng Cấp & Chi Tiết JD</span>
        </button>
      </div>
    </div>
  );
};
