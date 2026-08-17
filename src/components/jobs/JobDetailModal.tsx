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
  Users,
  Flame,
  ShieldCheck,
  Clock,
} from "lucide-react";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";
import { MatchScoreBadge } from "../scoring/MatchScoreBadge";
import { CompetitionBadge } from "./CompetitionBadge";
import { ScoreBreakdownCard } from "../scoring/ScoreBreakdownCard";
import { GapAnalysisCard } from "../scoring/GapAnalysisCard";
import { JobJdTab } from "./JobJdTab";
import { JobSkillsTab } from "./JobSkillsTab";

const DATA_SOURCE_LABEL: Record<string, string> = {
  LINKEDIN_VOYAGER: "LinkedIn API",
  LINKEDIN_JSONLD: "LinkedIn JSON-LD",
  LINKEDIN_DOM: "LinkedIn (đọc trang)",
  LINKEDIN_GUEST: "LinkedIn Guest API",
  MANUAL_JD: "Nhập thủ công",
};

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
  const isEasyApply = job.isEasyApply || job.applyType === "EASY_APPLY";

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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white p-1">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">{job.title}</h2>
                {isEasyApply && (
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#0A66C2]/20 text-[#38BDF8] border border-[#0A66C2]/70">
                    in Easy Apply
                  </span>
                )}
                <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {job.workMode === "ON_SITE" ? "On-site" : job.workMode === "REMOTE" ? "Remote" : "Hybrid"}
                </span>
                <CompetitionBadge
                  competitionLevel={job.competitionLevel}
                  applicantCountText={job.applicantCountText}
                  isPromoted={job.isPromoted}
                  responsesManagedOffLinkedIn={job.responsesManagedOffLinkedIn}
                  size="sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-200">{job.company}</span>
                <span className="text-slate-700">|</span>
                <span className="flex items-center gap-1 font-medium text-indigo-400">
                  <MapPin className="h-3 w-3" />
                  {job.locationDetails}
                </span>
                <span className="text-slate-700">|</span>
                {job.salaryRange ? (
                  <span className="flex items-center gap-1 font-mono font-semibold text-emerald-400">
                    <DollarSign className="h-3 w-3" />
                    {job.salaryRange.display}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-slate-500">
                    <DollarSign className="h-3 w-3" />
                    Không công bố
                  </span>
                )}
                {job.postedDate && (
                  <>
                    <span className="text-slate-700">|</span>
                    <span className="font-mono text-slate-400 text-[11px]">{job.postedDate}</span>
                  </>
                )}
              </div>

              {/* Truy vết nguồn dữ liệu */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {job.dataSource && (
                  <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
                    Nguồn: {DATA_SOURCE_LABEL[job.dataSource] ?? job.dataSource}
                  </span>
                )}
                {job.crawledAt && (
                  <span
                    title="Thời điểm bóc tách dữ liệu từ LinkedIn"
                    className="rounded border border-indigo-800/70 bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-indigo-300 flex items-center gap-1"
                  >
                    <Clock className="h-2.5 w-2.5 text-indigo-400" />
                    Cào lúc: {new Date(job.crawledAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {job.inferredFields && job.inferredFields.length > 0 && (
                  <span
                    title={`Hệ thống tự suy luận: ${job.inferredFields.join(", ")}`}
                    className="rounded border border-amber-800/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-400"
                  >
                    Suy luận: {job.inferredFields.length} trường
                  </span>
                )}
                {job.missingFields && job.missingFields.length > 0 && (
                  <span
                    title={`LinkedIn không công bố: ${job.missingFields.join(", ")}`}
                    className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-500"
                  >
                    Không công bố: {job.missingFields.length} trường
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("analysis")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "analysis"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Phân Tích Độ Khớp</span>
            </button>

            <button
              onClick={() => setActiveTab("jd")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "jd"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Mô Tả & Trách Nhiệm</span>
            </button>

            <button
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "skills"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>Ma Trận Kỹ Năng ({job.extractedSkills.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={applyStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="SAVED">Đã lưu theo dõi</option>
              <option value="APPLIED">Đã nộp đơn</option>
              <option value="SCREENING">Đang sơ loại</option>
              <option value="INTERVIEW">Đang phỏng vấn</option>
              <option value="OFFER">Nhận đề nghị (Offer)</option>
            </select>

            {job.linkedinUrl && (
              <a
                href={job.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${
                  isEasyApply
                    ? "bg-[#0A66C2] hover:bg-[#004182] text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                <span>{isEasyApply ? "Nộp qua Easy Apply" : "Mở Tin Tuyển Dụng"}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "analysis" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col items-center justify-center text-center">
                <MatchScoreBadge
                  score={score}
                  size="lg"
                  evidenceLevel={job.scoreResult?.evidence?.level}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Mức độ đáng nộp đơn: độ phủ kỹ năng, liên quan vai trò, phù hợp cấp bậc và cạnh tranh
                </p>
              </div>

              {job.scoreResult && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <ScoreBreakdownCard
                      breakdown={job.scoreResult.breakdown}
                      coverageRatio={job.scoreResult.coverageRatio}
                      evidence={job.scoreResult.evidence}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <GapAnalysisCard gapAnalysis={job.scoreResult.gapAnalysis} />
                  </div>
                </div>
              )}

              {/* Tín Hiệu Tuyển Dụng & Mức Độ Cạnh Tranh */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                      Tín Hiệu Thị Trường & Mức Độ Cạnh Tranh
                    </h4>
                  </div>
                  <CompetitionBadge
                    competitionLevel={job.competitionLevel}
                    applicantCountText={job.applicantCountText}
                    isPromoted={job.isPromoted}
                    responsesManagedOffLinkedIn={job.responsesManagedOffLinkedIn}
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-0.5">
                  <div className="rounded bg-slate-900/80 border border-slate-800 p-2 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">Lượt ứng tuyển:</span>
                    <p className="font-bold text-slate-100 font-mono text-xs">
                      {job.applicantCountText || "Chưa công bố"}
                    </p>
                  </div>

                  <div className="rounded bg-slate-900/80 border border-slate-800 p-2 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">Thời gian đăng:</span>
                    <p className="font-bold text-slate-100 font-mono text-xs">
                      {job.postedDate || "Không rõ"}
                    </p>
                  </div>

                  <div className="rounded bg-slate-900/80 border border-slate-800 p-2 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">Đặc tính tuyển dụng:</span>
                    <div className="flex flex-wrap gap-1">
                      {job.isPromoted && (
                        <span className="rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px] px-1 font-mono">
                          Promoted
                        </span>
                      )}
                      {job.responsesManagedOffLinkedIn && (
                        <span className="rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] px-1 font-mono">
                          Ngoài LinkedIn
                        </span>
                      )}
                      {job.isActivelyReviewing && (
                        <span className="rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] px-1 font-mono">
                          Đang duyệt
                        </span>
                      )}
                      {!job.isPromoted && !job.responsesManagedOffLinkedIn && !job.isActivelyReviewing && (
                        <span className="text-slate-500 font-mono text-[10px]">Tiêu chuẩn</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "jd" && <JobJdTab job={job} />}

          {activeTab === "skills" && <JobSkillsTab job={job} />}
        </div>
      </div>
    </div>
  );
};
