"use client";

import React, { useState } from "react";
import {
  FileUp,
  Sparkles,
  TrendingUp,
  Target,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Edit3,
  CheckCircle2,
  FileText,
} from "lucide-react";
import type { CvMatchingAnalysisResult } from "@/core/dtos/job-with-score.dto";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";
import { JobDetailModal } from "@/components/jobs/JobDetailModal";
import { CareerGrowthCard } from "@/components/cv/CareerGrowthCard";
import { JobTableView } from "@/components/jobs/JobTableView";

export default function CvJobMatcherPage() {
  const [cvText, setCvText] = useState("");
  const [isCvPanelOpen, setIsCvPanelOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"best_fit" | "career_growth">("best_fit");
  const [result, setResult] = useState<CvMatchingAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);

  const handleAnalyzeCv = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cvText.trim()) return;

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);

      const res = await fetch("/api/match-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        // Tự động thu gọn panel CV sau khi phân tích xong để tập trung xem bảng
        setIsCvPanelOpen(false);
      } else {
        setErrorMsg(data.message || "Không thể phân tích CV.");
      }
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ khi phân tích CV.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full px-2.5 sm:px-4 lg:px-6 py-3 space-y-3 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-indigo-400" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100">
            Tìm Việc Theo CV & Khám Phá Tiềm Năng Nâng Cấp Sự Nghiệp
          </h1>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 font-bold">
          100% Dữ Liệu CV Thật
        </span>
      </div>

      {/* Collapsible CV Panel */}
      <div className="w-full rounded-lg border border-slate-800 bg-slate-900 shadow-sm overflow-hidden transition-all duration-200">
        {/* Panel Header / Toggle Bar */}
        <div
          onClick={() => setIsCvPanelOpen(!isCvPanelOpen)}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 cursor-pointer select-none border-b border-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Nội Dung CV Thực Tế
            </h3>
            {cvText.trim() ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/60">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Đã nạp ({cvText.trim().length} ký tự)
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Chưa có nội dung
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {result && !isCvPanelOpen && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Đang xem kết quả của: <strong className="text-slate-200">{result.extractedProfile.fullName}</strong>
              </span>
            )}
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/60"
            >
              {isCvPanelOpen ? (
                <>
                  <span>Thu gọn panel CV</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3" />
                  <span>Mở rộng / Chỉnh sửa CV</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel Expanded Content */}
        {isCvPanelOpen && (
          <div className="p-3 sm:p-4 space-y-3 bg-slate-950/50">
            <form onSubmit={handleAnalyzeCv} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={8}
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Dán toàn bộ nội dung CV của bạn vào đây (Họ tên, kinh nghiệm, kỹ năng SQL, Power BI, BPMN, BABOK, Jira, dự án thực tế...)..."
                  className="w-full rounded border border-slate-700 bg-slate-950 p-3 text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none font-mono placeholder:text-slate-600 leading-relaxed"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {cvText && (
                    <button
                      type="button"
                      onClick={() => setCvText("")}
                      className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Xóa nội dung</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCvPanelOpen(false)}
                    className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Thu gọn
                  </button>
                  <button
                    type="submit"
                    disabled={isAnalyzing || !cvText.trim()}
                    className="flex items-center justify-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang Phân Tích & Đối Soát Việc Làm...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Phân Tích CV & Tìm Việc Khớp</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded border border-rose-900 bg-rose-950/40 p-2.5 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Results Section (Full Width) */}
      {!result && !isAnalyzing && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center min-h-[320px]">
          <Sparkles className="h-8 w-8 text-indigo-400 mb-2" />
          <h3 className="text-xs font-bold text-slate-300">
            Sẵn sàng bóc tách và khớp năng lực từ CV thực tế
          </h3>
          <p className="text-[11px] text-slate-500 max-w-md mt-1">
            Dán nội dung CV của bạn vào khung phía trên và bấm <strong>&quot;Phân Tích CV &amp; Tìm Việc Khớp&quot;</strong>. Hệ thống sẽ tự động trích xuất kỹ năng, kinh nghiệm và tính toán ma trận độ khớp với toàn bộ việc làm thật trong kho dữ liệu.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-3 w-full">
          {/* Profile Summary Pill */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-slate-200">
                Ứng viên: {result.extractedProfile.fullName} ({result.extractedProfile.targetRole})
              </span>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-800">
                {result.extractedProfile.detectedSeniority} (&ge;{result.extractedProfile.estimatedYears} năm KN)
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <div className="text-slate-400">
                Kỹ năng phát hiện: <span className="text-emerald-400 font-bold">{result.extractedProfile.skillsCount}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCvPanelOpen(true)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1 font-sans"
              >
                <Edit3 className="h-3 w-3" />
                <span>Xem/Đổi CV</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
            <button
              onClick={() => setActiveTab("best_fit")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "best_fit"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Việc Làm Khớp Nhất ({result.bestFitJobs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("career_growth")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "career_growth"
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Tiềm Năng Nâng Cấp ({result.growthOpportunities.length})</span>
            </button>
          </div>

          {/* Tab 1: Best Fit Jobs Table (Spacious Full Width View) */}
          {activeTab === "best_fit" && (
            <div className="space-y-2 w-full">
              {result.bestFitJobs.length === 0 ? (
                <div className="rounded border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                  Chưa có việc làm nào trong hệ thống khớp với bộ kỹ năng từ CV. Hãy thu thập thêm tin tuyển dụng thật từ LinkedIn.
                </div>
              ) : (
                <JobTableView
                  jobs={result.bestFitJobs}
                  onSelect={(j) => setSelectedJob(j)}
                />
              )}
            </div>
          )}

          {/* Tab 2: Career Growth Cards & Bridge Skills */}
          {activeTab === "career_growth" && (
            <div className="space-y-3 w-full">
              {/* Strategic Advice Box */}
              <div className="rounded-lg border border-purple-900/60 bg-purple-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span>Chiến Lược Nâng Cấp Vị Trí & Thu Nhập Cao</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-300">
                  {result.careerRoadmapTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Growth Cards Grid */}
              {result.growthOpportunities.length === 0 ? (
                <div className="rounded border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                  Chưa có vị trí Lead/Manager hoặc mức lương vượt trội trong kho dữ liệu để đối soát cơ hội thăng tiến.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {result.growthOpportunities.map((growthItem, idx) => (
                    <CareerGrowthCard
                      key={idx}
                      growthItem={growthItem}
                      onSelect={(job) => setSelectedJob(job)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal chi tiết */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
