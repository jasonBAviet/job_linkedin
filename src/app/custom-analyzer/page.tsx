"use client";

import React, { useState } from "react";
import {
  FileUp,
  Sparkles,
  TrendingUp,
  Target,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { CvMatchingAnalysisResult } from "@/core/services/cv-matcher-service";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "@/components/scoring/MatchScoreBadge";
import { JobDetailModal } from "@/components/jobs/JobDetailModal";
import { CareerGrowthCard } from "@/components/cv/CareerGrowthCard";
import { JobTableView } from "@/components/jobs/JobTableView";

const SAMPLE_CV = `Họ và tên: Nguyễn Văn An - Senior IT Business Analyst & Data Analytics
Kinh nghiệm: 4.5 năm kinh nghiệm phân tích nghiệp vụ và dữ liệu hệ thống phần mềm.
Vị trí gần nhất: Senior Business Analyst tại công ty giải pháp phần mềm tài chính ngân hàng.

Kỹ năng chuyên môn chính:
- Thu thập, phân tích và quản lý yêu cầu phần mềm theo chuẩn BABOK v3 (BRD, SRS, User Story, Acceptance Criteria).
- Vẽ sơ đồ quy trình nghiệp vụ BPMN 2.0, Sequence Diagram, Activity Diagram trên Figma và Draw.io.
- Truy vấn cơ sở dữ liệu SQL (PostgreSQL, SQL Server, MySQL): viết truy vấn phức tạp, CTE, Window Functions, tối ưu dữ liệu đối soát.
- Thiết kế Dashboard trực quan hóa dữ liệu trên Power BI và Tableau, viết công thức DAX cơ bản đến nâng cao.
- Phối hợp với Scrum Master và Developers trong mô hình Agile/Scrum, chủ trì nghiệm thu kiểm thử UAT.
- Hiểu biết nghiệp vụ: Fintech, Ngân hàng bán lẻ, E-commerce và Chuỗi cung ứng kho vận.
- Tiếng Anh làm việc tốt, kỹ năng thuyết trình và đàm phán với các bên liên quan (Stakeholder Management).`;

export default function CvJobMatcherPage() {
  const [cvText, setCvText] = useState(SAMPLE_CV);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"best_fit" | "career_growth">("best_fit");
  const [result, setResult] = useState<CvMatchingAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);

  const handleAnalyzeCv = async (e: React.FormEvent) => {
    e.preventDefault();
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-indigo-400" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100">
            Tìm Việc Theo CV & Khám Phá Tiềm Năng Nâng Cấp Sự Nghiệp
          </h1>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 font-bold">
          Chuẩn BABOK & High-Salary
        </span>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 w-full">
        {/* CV Input Box */}
        <div className="lg:col-span-4 space-y-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Nội Dung CV Cần Tìm Việc
              </h3>
              <button
                type="button"
                onClick={() => setCvText(SAMPLE_CV)}
                className="text-[10px] font-mono text-indigo-400 hover:underline"
              >
                Mẫu Senior BA/DA
              </button>
            </div>

            <form onSubmit={handleAnalyzeCv} className="space-y-2">
              <textarea
                rows={10}
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Dán toàn bộ nội dung CV (kỹ năng, kinh nghiệm, dự án) vào đây..."
                className="w-full rounded border border-slate-700 bg-slate-950 p-2.5 text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
                required
              />

              <button
                type="submit"
                disabled={isAnalyzing || !cvText.trim()}
                className="w-full flex items-center justify-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-bold text-white disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang Phân Tích & Tìm Kiếm Việc...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tìm Việc & Lộ Trình Nâng Cấp</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results Stream */}
        <div className="lg:col-span-8 space-y-3">
          {errorMsg && (
            <div className="rounded border border-rose-900 bg-rose-950/40 p-2.5 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {!result && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center h-full min-h-[300px]">
              <Sparkles className="h-8 w-8 text-indigo-400 mb-2" />
              <h3 className="text-xs font-bold text-slate-300">
                Sẵn sàng quét việc làm theo CV của bạn
              </h3>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                Hệ thống sẽ tự động bóc tách kỹ năng, tính điểm tương thích và đề xuất cơ hội thăng tiến mức lương &gt; 40-75 Triệu VNĐ.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {/* Profile Summary Pill */}
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Phát hiện: {result.extractedProfile.targetRole}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-800">
                    {result.extractedProfile.detectedSeniority} (&ge;{result.extractedProfile.estimatedYears}y KN)
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  Kỹ năng trích xuất: <span className="text-emerald-400 font-bold">{result.extractedProfile.skillsCount}</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
                <button
                  onClick={() => setActiveTab("best_fit")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-colors ${
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
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                    activeTab === "career_growth"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Tiềm Năng Nâng Cấp & Mở Rộng ({result.growthOpportunities.length})</span>
                </button>
              </div>

              {/* Tab 1: Best Fit Jobs Table */}
              {activeTab === "best_fit" && (
                <div className="space-y-2">
                  <JobTableView
                    jobs={result.bestFitJobs}
                    onSelect={(j) => setSelectedJob(j)}
                  />
                </div>
              )}

              {/* Tab 2: Career Growth Cards & Bridge Skills */}
              {activeTab === "career_growth" && (
                <div className="space-y-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.growthOpportunities.map((growthItem, idx) => (
                      <CareerGrowthCard
                        key={idx}
                        growthItem={growthItem}
                        onSelect={(job) => setSelectedJob(job)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal chi tiết */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
