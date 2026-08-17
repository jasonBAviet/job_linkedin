"use client";

import React from "react";
import { CheckCircle } from "lucide-react";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";

interface JobSkillsTabProps {
  job: JobWithScore;
}

export const JobSkillsTab: React.FC<JobSkillsTabProps> = ({ job }) => {
  const matchedSkills = job.scoreResult?.gapAnalysis?.matchedSkills || [];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[500px]">
          <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-semibold font-mono">
          <tr>
            <th className="px-3.5 py-2.5">Kỹ Năng</th>
            <th className="px-3.5 py-2.5">Phân Loại</th>
            <th className="px-3.5 py-2.5">Mức Độ</th>
            <th className="px-3.5 py-2.5">Trạng Thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {job.extractedSkills.map((s, idx) => {
            const isMatched = matchedSkills.includes(s.name);
            return (
              <tr key={idx} className="hover:bg-slate-900/50">
                <td className="px-3.5 py-2.5 font-bold text-slate-200">{s.name}</td>
                <td className="px-3.5 py-2.5 text-slate-400 font-mono">{s.category}</td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                      s.importance === "MUST_HAVE"
                        ? "bg-rose-950/70 text-rose-300 border border-rose-800/60"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {s.importance === "MUST_HAVE" ? "Bắt Buộc" : "Điểm Cộng"}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  {isMatched ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-400 text-[11px]">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      Đạt chuẩn
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[11px]">Chưa có</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};
