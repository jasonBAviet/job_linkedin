"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  MapPin,
  Building2,
  DollarSign,
  CheckCircle,
  FileText,
  BarChart2,
  ListChecks,
} from "lucide-react";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";
import { SkillRadarChart } from "../scoring/SkillRadarChart";
import { ScoreBreakdownCard } from "../scoring/ScoreBreakdownCard";
import { GapAnalysisCard } from "../scoring/GapAnalysisCard";

interface JobDetailModalProps {
  job: JobWithScore | null;
  onClose: () => void;
  onTrackStatus?: (jobId: string, status: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onTrackStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"analysis" | "jd" | "skills">("analysis");
  const [applyStatus, setApplyStatus] = useState<string>("SAVED");
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!job) return null;

  const score = job.scoreResult?.totalScore || 0;

  const handleStatusChange = async (status: string) => {
    setApplyStatus(status);
    if (onTrackStatus) {
      onTrackStatus(job.id, status);
    }
    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, status }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-950 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-700 p-1">
              {job.companyLogo ? (
                <img
                  src={job.companyLogo}
                  alt={job.company}
                  className="h-full w-full object-contain rounded"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <Building2 className="h-5 w-5 text-slate-400" />
              )}
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">{job.title}</h2>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-200">{job.company}</span>
                <span className="text-slate-700">|</span>
                <span className="flex items-center gap-1 font-medium text-indigo-400">
                  <MapPin className="h-3 w-3" />
                  {job.locationDetails}
                </span>
                {job.salaryRange && (
                  <>
                    <span className="text-slate-700">|</span>
                    <span className="flex items-center gap-1 font-mono font-semibold text-emerald-400">
                      <DollarSign className="h-3 w-3" />
                      {job.salaryRange.display}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action & Status Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-2 gap-2">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("analysis")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTab === "analysis"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Chấm Điểm & Khoảng Cách</span>
            </button>
            <button
              onClick={() => setActiveTab("jd")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTab === "jd"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Chi Tiết JD</span>
            </button>
            <button
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTab === "skills"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>Kỹ Năng ({job.extractedSkills.length})</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <select
              value={applyStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer font-mono"
            >
              <option value="SAVED">Đã lưu</option>
              <option value="APPLIED">Đã nộp</option>
              <option value="SCREENING">Sơ loại CV</option>
              <option value="INTERVIEW">Phỏng vấn</option>
              <option value="OFFER">Nhận Offer</option>
            </select>
            {savedSuccess && <span className="text-[11px] text-emerald-400">Đã cập nhật</span>}

            {job.linkedinUrl && (
              <a
                href={job.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors"
              >
                <span>Mở LinkedIn</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-slate-200">
          {activeTab === "analysis" && (
            <div className="space-y-5">
              <MatchScoreBadge score={score} size="lg" />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {job.scoreResult?.radarData && (
                  <SkillRadarChart data={job.scoreResult.radarData} />
                )}
                {job.scoreResult?.breakdown && (
                  <ScoreBreakdownCard breakdown={job.scoreResult.breakdown} />
                )}
              </div>

              {job.scoreResult?.gapAnalysis && (
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2">
                    Phân Tích Khoảng Cách Kỹ Năng & Chiến Lược Săn Việc
                  </h3>
                  <GapAnalysisCard gapAnalysis={job.scoreResult.gapAnalysis} />
                </div>
              )}
            </div>
          )}

          {activeTab === "jd" && (
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
          )}

          {activeTab === "skills" && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <table className="w-full text-left text-xs">
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
                    const isMatched = job.scoreResult?.gapAnalysis?.matchedSkills?.includes(s.name);
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
          )}
        </div>
      </div>
    </div>
  );
};
