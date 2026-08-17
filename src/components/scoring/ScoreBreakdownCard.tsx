import React from "react";
import { ScoreBreakdown, ScoreEvidence } from "@/core/dtos/scoring.dto";
import { DEFAULT_SYSTEM_CONFIG } from "@/core/constants/app-config";
import { Code2, Briefcase, Target, TrendingUp, MapPin, AlertTriangle } from "lucide-react";

interface ScoreBreakdownCardProps {
  breakdown: ScoreBreakdown;
  coverageRatio?: number | null;
  evidence?: ScoreEvidence;
}

// Điểm tối đa lấy từ cấu hình thay vì khai báo lại, tránh lệch khi đổi ngân sách điểm
const WEIGHTS = DEFAULT_SYSTEM_CONFIG.scoringWeights;

export const ScoreBreakdownCard: React.FC<ScoreBreakdownCardProps> = ({
  breakdown,
  coverageRatio,
  evidence,
}) => {
  const items = [
    {
      title: "Độ phủ kỹ năng JD yêu cầu",
      score: breakdown.skillCoverageScore,
      max: WEIGHTS.skillCoverageMax,
      icon: Code2,
      description:
        coverageRatio === null || coverageRatio === undefined
          ? "Không trích được yêu cầu kỹ năng nào từ JD"
          : `Đáp ứng ${Math.round(coverageRatio * 100)}% khối lượng yêu cầu (đã tính trọng số)`,
      color: "bg-indigo-500",
      lightColor: "bg-indigo-950/80 text-indigo-400 border border-indigo-800/60",
    },
    {
      title: "Liên quan vai trò",
      score: breakdown.roleRelevanceScore,
      max: WEIGHTS.roleRelevanceMax,
      icon: Target,
      description: "Vai trò của tin tuyển dụng so với định hướng BA/DA của bạn",
      color: "bg-blue-500",
      lightColor: "bg-blue-950/80 text-blue-400 border border-blue-800/60",
    },
    {
      title: "Phù hợp cấp bậc",
      score: breakdown.seniorityFitScore,
      max: WEIGHTS.seniorityFitMax,
      icon: Briefcase,
      description: "Khớp cấp bậc, trừ điểm cả khi job thấp hơn lẫn cao hơn hồ sơ",
      color: "bg-emerald-500",
      lightColor: "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60",
    },
    {
      title: "Cơ hội & cạnh tranh",
      score: breakdown.opportunityScore,
      max: WEIGHTS.opportunityMax,
      icon: TrendingUp,
      description: "Số ứng viên đã nộp và việc nhà tuyển dụng có đang xem xét hồ sơ",
      color: "bg-amber-500",
      lightColor: "bg-amber-950/80 text-amber-400 border border-amber-800/60",
    },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-sm font-bold text-slate-200">Cơ cấu điểm đáng nộp đơn</h3>
        <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
          Tổng: {breakdown.totalScore} / 100 đ
        </div>
      </div>

      {evidence && evidence.level === "LOW" && (
        <div className="mb-3 flex items-start gap-2 rounded border border-amber-800/60 bg-amber-950/40 p-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-200">
            {evidence.reason ?? "Dữ liệu JD chưa đủ để chấm điểm tin cậy."}{" "}
            <span className="text-amber-400/80">
              Điểm thấp ở đây phản ánh thiếu dữ liệu, không hẳn là job không phù hợp.
            </span>
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const percentage = item.max > 0 ? Math.round((item.score / item.max) * 100) : 0;

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <div className={`p-1 rounded ${item.lightColor}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span>{item.title}</span>
                </div>
                <div className="font-mono font-bold text-slate-200">
                  {item.score} <span className="text-slate-500 font-normal">/ {item.max}đ</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${item.color}`}
                  style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-400 font-mono">{item.description}</p>
            </div>
          );
        })}
      </div>

      {breakdown.locationMultiplier < 1 && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
          <MapPin className="h-3 w-3 text-amber-400" />
          <span>
            Địa điểm ngoài khu vực ưu tiên — tổng điểm đã nhân hệ số{" "}
            <span className="font-mono text-amber-400">{breakdown.locationMultiplier}</span>
          </span>
        </div>
      )}
    </div>
  );
};
