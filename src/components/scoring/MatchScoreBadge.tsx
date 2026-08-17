import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Info, HelpCircle } from "lucide-react";
import { SCORE_TIER_THRESHOLDS } from "@/core/constants/app-config";
import { ScoreEvidenceLevel } from "@/core/dtos/scoring.dto";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** Khi là LOW, điểm phản ánh thiếu dữ liệu JD chứ không hẳn là job không phù hợp */
  evidenceLevel?: ScoreEvidenceLevel;
}

interface TierStyle {
  badgeStyle: string;
  scoreTextColor: string;
  labelText: string;
  Icon: typeof Sparkles;
}

// Ngưỡng lấy từ cấu hình dùng chung với scoring service, không khai báo lại
function resolveTier(score: number): TierStyle {
  if (score >= SCORE_TIER_THRESHOLDS.PERFECT_MATCH) {
    return {
      badgeStyle: "bg-emerald-950/70 text-emerald-300 border-emerald-600/70",
      scoreTextColor: "text-emerald-400",
      labelText: "Rất Phù Hợp",
      Icon: Sparkles,
    };
  }
  if (score >= SCORE_TIER_THRESHOLDS.HIGH_MATCH) {
    return {
      badgeStyle: "bg-blue-950/70 text-blue-300 border-blue-600/70",
      scoreTextColor: "text-blue-400",
      labelText: "Phù Hợp Cao",
      Icon: CheckCircle2,
    };
  }
  if (score >= SCORE_TIER_THRESHOLDS.MODERATE_MATCH) {
    return {
      badgeStyle: "bg-amber-950/70 text-amber-300 border-amber-600/70",
      scoreTextColor: "text-amber-400",
      labelText: "Khớp Trung Bình",
      Icon: AlertTriangle,
    };
  }
  return {
    badgeStyle: "bg-slate-800/80 text-slate-300 border-slate-700",
    scoreTextColor: "text-slate-300",
    labelText: "Ít Phù Hợp",
    Icon: Info,
  };
}

const LOW_EVIDENCE_TITLE =
  "JD quá sơ sài để chấm điểm tin cậy — điểm thấp ở đây phản ánh thiếu dữ liệu, không hẳn là job không phù hợp.";

export const MatchScoreBadge: React.FC<MatchScoreBadgeProps> = ({
  score,
  size = "md",
  showLabel = true,
  evidenceLevel,
}) => {
  const { badgeStyle, scoreTextColor, labelText, Icon } = resolveTier(score);
  const isLowEvidence = evidenceLevel === "LOW";

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold border ${badgeStyle}`}
        title={isLowEvidence ? LOW_EVIDENCE_TITLE : `${score}% — ${labelText}`}
      >
        <span>{score}%</span>
        {isLowEvidence && <HelpCircle className="h-2.5 w-2.5 opacity-80" />}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className={`flex items-center gap-3 rounded-lg border p-3 ${badgeStyle}`}>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded bg-slate-900 font-mono font-black text-lg border border-slate-700 ${scoreTextColor}`}
        >
          {score}%
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <Icon className="h-4 w-4" />
            <span>{labelText}</span>
          </div>
          <p className="text-xs text-slate-400">
            {isLowEvidence ? LOW_EVIDENCE_TITLE : "Mức độ đáng nộp đơn so với hồ sơ của bạn"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-bold border ${badgeStyle}`}
      title={isLowEvidence ? LOW_EVIDENCE_TITLE : undefined}
    >
      <Icon className="h-3 w-3" />
      <span>{score}% Khớp</span>
      {showLabel && <span className="opacity-75 font-sans font-normal text-[11px]">| {labelText}</span>}
      {isLowEvidence && <HelpCircle className="h-3 w-3 opacity-80" />}
    </div>
  );
};
