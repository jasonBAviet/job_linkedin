import React from "react";
import { Briefcase, MapPin, TrendingUp, Sparkles, Database, CheckCircle2 } from "lucide-react";
import { JobWithScore } from "@/core/services/job-service";

interface MarketOverviewMetricsProps {
  jobs: JobWithScore[];
}

export const MarketOverviewMetrics: React.FC<MarketOverviewMetricsProps> = ({ jobs }) => {
  const totalJobs = jobs.length;
  const hcmJobs = jobs.filter((j) => j.location === "HO_CHI_MINH").length;
  const dnJobs = jobs.filter((j) => j.location === "DONG_NAI").length;

  const avgScore =
    totalJobs > 0
      ? Math.round(jobs.reduce((acc, curr) => acc + (curr.scoreResult?.totalScore || 0), 0) / totalJobs)
      : 0;

  const highMatchCount = jobs.filter((j) => (j.scoreResult?.totalScore || 0) >= 75).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Tổng việc làm */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Tổng Việc Làm LinkedIn</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Briefcase className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900">{totalJobs}</div>
        <p className="text-xs text-slate-500 mt-1">Vị trí BA & DA đang mở</p>
      </div>

      {/* 2. Địa bàn HCM & Đồng Nai */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Phân Bổ Vùng Địa Lý</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <MapPin className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-indigo-700">{hcmJobs}</span>
          <span className="text-xs font-medium text-slate-500">HCM</span>
          <span className="text-slate-300">/</span>
          <span className="text-xl font-black text-amber-700">{dnJobs}</span>
          <span className="text-xs font-medium text-slate-500">Đồng Nai</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Trọng điểm KCN & Trung tâm tài chính</p>
      </div>

      {/* 3. Độ phù hợp trung bình */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Độ Khớp Trung Bình</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-blue-700">{avgScore}%</div>
        <p className="text-xs text-slate-500 mt-1">So khớp với hồ sơ ứng viên của bạn</p>
      </div>

      {/* 4. Việc làm rất phù hợp */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Cơ Hội Cao ({">= 75%"})</span>
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-purple-700">{highMatchCount}</div>
        <p className="text-xs text-slate-500 mt-1">Khả năng đậu phỏng vấn cao nhất</p>
      </div>
    </div>
  );
};
