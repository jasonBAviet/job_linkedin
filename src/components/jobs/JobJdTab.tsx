"use client";

import React from "react";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";

interface JobJdTabProps {
  job: JobWithScore;
}

export const JobJdTab: React.FC<JobJdTabProps> = ({ job }) => {
  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
        <h4 className="text-sm font-bold text-slate-100 mb-2">Trách Nhiệm Công Việc</h4>
        <ul className="space-y-1.5">
          {job.responsibilitiesSummary.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span className="text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
        <h4 className="text-sm font-bold text-slate-100 mb-2">Yêu Cầu Ứng Viên</h4>
        <ul className="space-y-1.5">
          {job.requirementsSummary.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span className="text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">
          Toàn văn mô tả công việc (Raw JD)
        </h4>
        <p className="whitespace-pre-line text-slate-400 font-mono text-[11px] leading-relaxed">
          {job.jobDescription}
        </p>
      </div>
    </div>
  );
};
