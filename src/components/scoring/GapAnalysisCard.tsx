import React from "react";
import { GapAnalysisResult } from "@/core/dtos/scoring.dto";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  MessageSquareQuote,
  Target,
} from "lucide-react";

interface GapAnalysisCardProps {
  gapAnalysis: GapAnalysisResult;
}

export const GapAnalysisCard: React.FC<GapAnalysisCardProps> = ({ gapAnalysis }) => {
  return (
    <div className="space-y-3 font-sans">
      {/* 1. Kỹ năng đã đáp ứng vs Kỹ năng còn thiếu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Đã đáp ứng */}
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3">
          <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Kỹ Năng Đã Đáp Ứng ({gapAnalysis.matchedSkills.length})</span>
          </div>
          {gapAnalysis.matchedSkills.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">Chưa có kỹ năng khớp hoàn toàn.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {gapAnalysis.matchedSkills.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-mono text-emerald-300 border border-emerald-800/60"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cần bổ sung */}
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3">
          <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Kỹ Năng Cần Bổ Sung (Gap)</span>
          </div>

          <div className="space-y-2">
            {gapAnalysis.missingMustHaveSkills.length > 0 && (
              <div>
                <p className="text-[10px] font-mono font-bold uppercase text-rose-400 mb-1">
                  Bắt buộc (Must-Have):
                </p>
                <div className="flex flex-wrap gap-1">
                  {gapAnalysis.missingMustHaveSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-mono text-rose-300 border border-rose-800/60"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {gapAnalysis.missingGoodToHaveSkills.length > 0 && (
              <div>
                <p className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-1">
                  Điểm cộng:
                </p>
                <div className="flex flex-wrap gap-1">
                  {gapAnalysis.missingGoodToHaveSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700"
                    >
                      <HelpCircle className="h-2.5 w-2.5 text-slate-500" />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {gapAnalysis.missingMustHaveSkills.length === 0 &&
              gapAnalysis.missingGoodToHaveSkills.length === 0 && (
                <p className="text-[11px] text-emerald-400 font-mono">
                  Xuất sắc! Hồ sơ của bạn đáp ứng trọn vẹn toàn bộ yêu cầu của JD này.
                </p>
              )}
          </div>
        </div>
      </div>

      {/* 2. Gợi ý tối ưu CV và Chuẩn bị Phỏng vấn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Đề xuất tối ưu CV */}
        <div className="rounded-lg border border-indigo-900/60 bg-indigo-950/30 p-3">
          <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-xs mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-400" />
            <span>Tối Ưu CV Cho Vị Trí Này</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {gapAnalysis.improvementSuggestions.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <Target className="h-3 w-3 text-indigo-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Chuẩn bị phỏng vấn */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs mb-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-blue-400" />
            <span>Trọng Tâm Phỏng Vấn (STAR Method)</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {gapAnalysis.interviewPrepTips.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
