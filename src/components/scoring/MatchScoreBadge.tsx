import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const MatchScoreBadge: React.FC<MatchScoreBadgeProps> = ({
  score,
  size = "md",
  showLabel = true,
}) => {
  let badgeStyle = "bg-emerald-950/60 text-emerald-300 border-emerald-700/60";
  let labelText = "Rất Phù Hợp";
  let Icon = Sparkles;

  if (score >= 85) {
    badgeStyle = "bg-emerald-950/70 text-emerald-300 border-emerald-600/70";
    labelText = "Rất Phù Hợp";
    Icon = Sparkles;
  } else if (score >= 70) {
    badgeStyle = "bg-blue-950/70 text-blue-300 border-blue-600/70";
    labelText = "Phù Hợp Cao";
    Icon = CheckCircle2;
  } else if (score >= 50) {
    badgeStyle = "bg-amber-950/70 text-amber-300 border-amber-600/70";
    labelText = "Khớp Trung Bình";
    Icon = AlertTriangle;
  } else {
    badgeStyle = "bg-slate-800/80 text-slate-300 border-slate-700";
    labelText = "Ít Phù Hợp";
    Icon = Info;
  }

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold border ${badgeStyle}`}
      >
        <span>{score}%</span>
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className={`flex items-center gap-3 rounded-lg border p-3 ${badgeStyle}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900 font-mono font-black text-lg text-emerald-400 border border-slate-700">
          {score}%
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <Icon className="h-4 w-4" />
            <span>{labelText}</span>
          </div>
          <p className="text-xs text-slate-400">Độ khớp thuật toán BABOK với hồ sơ của bạn</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-bold border ${badgeStyle}`}
    >
      <Icon className="h-3 w-3" />
      <span>{score}% Khớp</span>
      {showLabel && <span className="opacity-75 font-sans font-normal text-[11px]">| {labelText}</span>}
    </div>
  );
};
