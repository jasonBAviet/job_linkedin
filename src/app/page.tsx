"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { JobFilterBar } from "@/components/jobs/JobFilterBar";
import { JobTableView } from "@/components/jobs/JobTableView";
import { JobDetailModal } from "@/components/jobs/JobDetailModal";
import type { JobWithScore } from "@/core/dtos/job-with-score.dto";
import { JobSearchFilters, JobUserStatus } from "@/core/dtos/job.dto";
import {
  detectExtension,
  startRemoteCrawl,
  stopRemoteCrawl,
  getRemoteStatus,
  setPassiveEnabled,
  setAutoOpenEnabled,
  onCrawlEvent,
  describeBridgeError,
  type CrawlOrigin,
  type PassiveState,
} from "@/core/utils/extension-bridge";
import { RefreshCw, AlertCircle, MapPin, DownloadCloud, FileText, CheckCircle2, Bookmark, Square, MousePointerClick } from "lucide-react";

export default function HomePage() {
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<JobUserStatus, number>>({ NEW: 0, SAVED: 0, VIEWED: 0, HIDDEN: 0 });
  const [crawlState, setCrawlState] = useState<{
    isRunning: boolean;
    crawledCount: number;
    pageNumber: number;
    origin?: CrawlOrigin;
  }>({ isRunning: false, crawledCount: 0, pageNumber: 1 });
  // Khởi tạo TẮT cho khớp ngữ nghĩa opt-in của extension — khởi tạo `true` sẽ
  // nháy "BẬT" một nhịp trước khi getRemoteStatus() trả về sự thật.
  const [passiveState, setPassiveState] = useState<PassiveState>({
    enabled: false,
    autoOpen: false,
    savedCount: 0,
  });

  const [filters, setFilters] = useState<JobSearchFilters>({
    keyword: "",
    company: "",
    location: "ALL",
    roleCategory: "ALL",
    seniority: "ALL",
    datePosted: "ALL",
    workMode: "ALL",
    applyType: "ALL",
    isEasyApply: false,
    competitionLevel: "ALL",
    minExperienceYears: 0,
    minSalaryVND: 0,
    minScore: 0,
    hasSalary: false,
    userStatus: "ALL",
  });

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.company) params.set("company", filters.company);
      if (filters.location) params.set("location", filters.location);
      if (filters.roleCategory) params.set("roleCategory", filters.roleCategory);
      if (filters.seniority) params.set("seniority", filters.seniority);
      if (filters.datePosted && filters.datePosted !== "ALL") params.set("datePosted", filters.datePosted);
      if (filters.workMode && filters.workMode !== "ALL") params.set("workMode", filters.workMode);
      if (filters.applyType && filters.applyType !== "ALL") params.set("applyType", filters.applyType);
      if (filters.isEasyApply) params.set("isEasyApply", "true");
      if (filters.competitionLevel && filters.competitionLevel !== "ALL") params.set("competitionLevel", filters.competitionLevel);
      if (filters.minExperienceYears) params.set("minExperienceYears", String(filters.minExperienceYears));
      if (filters.minSalaryVND) params.set("minSalaryVND", String(filters.minSalaryVND));
      if (filters.minScore) params.set("minScore", String(filters.minScore));
      if (filters.hasSalary) params.set("hasSalary", "true");
      if (filters.userStatus && filters.userStatus !== "ALL") params.set("userStatus", filters.userStatus);

      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.data);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
      } else {
        setError(data.message || "Không thể tải danh sách việc làm.");
      }
    } catch {
      setError("Lỗi kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Giữ tham chiếu mới nhất để các effect chỉ chạy 1 lần vẫn gọi được fetchJobs
  // hiện hành mà không phải đăng ký lại mỗi khi bộ lọc đổi.
  const fetchJobsRef = useRef(fetchJobs);
  useEffect(() => {
    fetchJobsRef.current = fetchJobs;
  }, [fetchJobs]);

  const handleFilterChange = (newFilters: Partial<JobSearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleStatusChange = async (jobId: string, status: JobUserStatus) => {
    try {
      const res = await fetch("/api/jobs/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status }),
      });
      const data = await res.json();
      if (data.success) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, userStatus: status } as any : j
          ).filter((j) => {
            if (status === "HIDDEN" && j.id === jobId && (!filters.userStatus || filters.userStatus === "ALL")) {
              return false;
            }
            return true;
          })
        );
        if (data.counts) setStatusCounts(data.counts);
      }
    } catch {
      // Im lang khi loi mang
    }
  };

  // Bám lại phiên cào đang chạy (vd người dùng F5 dashboard giữa chừng)
  // và lắng nghe tiến trình extension đẩy về.
  useEffect(() => {
    let cancelled = false;

    getRemoteStatus().then((res) => {
      if (cancelled || !res.ok) return;
      const p = res.payload;
      if (p.passive) setPassiveState(p.passive);
      if (p.isRunning) {
        setCrawlState({
          isRunning: true,
          crawledCount: p.crawledCount || 0,
          pageNumber: p.pageNumber || 1,
          origin: p.origin,
        });
      }
    });

    const unsubscribe = onCrawlEvent(({ event, payload }) => {
      // Chế độ ghi chạy độc lập với phiên cào tự động — cập nhật riêng
      if (event === "PASSIVE_PROGRESS") {
        setPassiveState({
          enabled: !!payload.enabled,
          autoOpen: !!payload.enabled && !!payload.autoOpen,
          savedCount: payload.savedCount || 0,
        });
        if (payload.phase !== "enabled" && payload.phase !== "disabled") fetchJobsRef.current();
        return;
      }

      if (event === "CRAWL_ERROR") {
        setScrapeMsg({ type: "error", text: payload.message || describeBridgeError(payload.code) });
        return;
      }

      const isRunning = event !== "CRAWL_DONE";
      setCrawlState({
        isRunning,
        crawledCount: payload.crawledCount || 0,
        pageNumber: payload.pageNumber || 1,
        origin: payload.origin,
      });

      if (event === "CRAWL_STARTED") {
        setScrapeMsg({
          type: "success",
          text:
            payload.origin === "WIDGET"
              ? "Phát hiện phiên cào vừa bật từ tab LinkedIn. Đang theo dõi tiến trình."
              : payload.origin === "POPUP"
              ? "Phiên cào vừa bật từ popup Extension. Đang theo dõi tiến trình."
              : "Extension đã mở tab LinkedIn và bắt đầu cào. Giữ tab đó mở cho tới khi xong.",
        });
      } else if (event === "CRAWL_DONE") {
        const count = payload.crawledCount || 0;
        const suffix = payload.code ? ` (${describeBridgeError(payload.code)})` : "";
        setScrapeMsg({
          type: count > 0 ? "success" : "error",
          text:
            count > 0
              ? `Đã cào xong ${count} việc làm thật từ LinkedIn.${suffix}`
              : `Phiên cào kết thúc nhưng chưa lưu được việc làm nào.${suffix}`,
        });
        fetchJobsRef.current();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Trong lúc cào, làm mới bảng định kỳ để dữ liệu chảy về dần
  useEffect(() => {
    if (!crawlState.isRunning) return;
    const timer = setInterval(() => fetchJobsRef.current(), 5000);
    return () => clearInterval(timer);
  }, [crawlState.isRunning]);

  const handleTogglePassive = async () => {
    const next = !passiveState.enabled;
    // Tắt thì hạ luôn tầng phụ: bật lại lần sau phải là một quyết định mới,
    // không âm thầm kế thừa quyền tự click từ phiên trước.
    const res = await setPassiveEnabled(next, next && passiveState.autoOpen);

    if (!res.ok) {
      setScrapeMsg({ type: "error", text: describeBridgeError(res.code) });
      return;
    }

    setPassiveState(res.payload);
    setScrapeMsg({
      type: "success",
      text: next
        ? "Đã bật chế độ ghi. Việc làm bạn tự bấm mở trên LinkedIn sẽ chảy về đây."
        : "Đã tắt chế độ ghi trên mọi tab LinkedIn.",
    });
  };

  const handleToggleAutoOpen = async () => {
    if (!passiveState.enabled) return;
    const next = !passiveState.autoOpen;
    const res = await setAutoOpenEnabled(next);

    if (!res.ok) {
      setScrapeMsg({ type: "error", text: describeBridgeError(res.code) });
      return;
    }

    setPassiveState(res.payload);
    setScrapeMsg({
      type: "success",
      text: next
        ? "Đã bật tự mở JD. Thẻ nào dừng trong tầm nhìn sẽ được Extension mở rồi lưu."
        : "Đã tắt tự mở JD. Chỉ còn lưu việc làm bạn tự bấm mở.",
    });
  };

  const handleExtensionCrawl = async () => {
    setScrapeMsg(null);
    setIsScraping(true);

    try {
      const detection = await detectExtension();
      if (!detection.installed) {
        setScrapeMsg({
          type: "error",
          text: detection.needsReload
            ? "Extension vừa được tải lại. Hãy F5 trang này rồi bấm lại."
            : "Chưa phát hiện Extension. Mở chrome://extensions → bật Developer mode → Load unpacked → chọn thư mục extension/ của dự án, rồi tải lại trang.",
        });
        return;
      }

      const res = await startRemoteCrawl({
        location: filters.location,
        roleCategory: filters.roleCategory,
        seniority: filters.seniority,
        datePosted: filters.datePosted,
        workMode: filters.workMode,
        keyword: filters.keyword,
        isEasyApply: filters.isEasyApply,
      });

      if (!res.ok) {
        setScrapeMsg({ type: "error", text: describeBridgeError(res.code) });
        if (res.code === "ALREADY_RUNNING") {
          setCrawlState({
            isRunning: true,
            crawledCount: res.payload.crawledCount || 0,
            pageNumber: 1,
          });
        }
        return;
      }

      setCrawlState({ isRunning: true, crawledCount: 0, pageNumber: 1 });
      setScrapeMsg({
        type: "success",
        text: "Đang mở tab LinkedIn theo bộ lọc hiện tại...",
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleStopCrawl = async () => {
    const res = await stopRemoteCrawl();
    setCrawlState((prev) => ({ ...prev, isRunning: false }));
    if (res.ok) fetchJobs();
  };

  const totalCount = jobs.length;
  const hcmCount = jobs.filter((j) => j.location === "HO_CHI_MINH").length;
  const dnCount = jobs.filter((j) => j.location === "DONG_NAI").length;
  const avgMatch =
    totalCount > 0
      ? Math.round(jobs.reduce((acc, curr) => acc + (curr.scoreResult?.totalScore || 0), 0) / totalCount)
      : 0;

  return (
    <div className="w-full px-2.5 sm:px-4 lg:px-6 py-2.5 space-y-2">
      {/* Quick Stats & Hunter Headline */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight">
            Săn Việc Senior & Lead BA / DA (100% Dữ Liệu Thật)
          </h1>
          <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-800/80 font-bold">
            Real LinkedIn Data
          </span>
        </div>

        {/* Action & Stats */}
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono text-slate-400">
          <button
            onClick={handleTogglePassive}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-sans font-semibold transition-colors cursor-pointer ${
              passiveState.enabled
                ? "border-sky-700 bg-sky-950/70 text-sky-300 hover:bg-sky-900/70"
                : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
            title="Bật thì việc làm bạn tự bấm mở trên LinkedIn sẽ được lưu về đây. Tự tắt khi im lặng 2 phút, rời danh sách việc làm, hoặc đóng tab LinkedIn cuối."
          >
            <MousePointerClick className="h-3 w-3" />
            <span className="hidden lg:inline">Chế độ ghi:</span>
            <span>{passiveState.enabled ? `BẬT · ${passiveState.savedCount}` : "TẮT"}</span>
          </button>

          {passiveState.enabled && (
            <button
              onClick={handleToggleAutoOpen}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-sans font-semibold transition-colors cursor-pointer ${
                passiveState.autoOpen
                  ? "border-purple-700 bg-purple-950/70 text-purple-300 hover:bg-purple-900/70"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
              title="Bật thì thẻ nào dừng trong tầm nhìn sẽ được Extension tự mở rồi lưu — trang sẽ tự nhảy pane chi tiết khi bạn cuộn."
            >
              <span className="hidden lg:inline">Tự mở JD:</span>
              <span>{passiveState.autoOpen ? "BẬT" : "TẮT"}</span>
            </button>
          )}

          {crawlState.isRunning ? (
            <button
              onClick={handleStopCrawl}
              className="flex items-center gap-1 rounded bg-rose-600/90 hover:bg-rose-600 px-2.5 py-1 text-[11px] font-sans font-bold text-white transition-colors cursor-pointer"
              title={`Đang cào trang ${crawlState.pageNumber} qua Extension`}
            >
              <Square className="h-3 w-3 fill-current" />
              <span>
                Dừng cào (đã lưu {crawlState.crawledCount}
                {crawlState.origin === "WIDGET"
                  ? " · từ LinkedIn"
                  : crawlState.origin === "POPUP"
                  ? " · từ popup"
                  : ""}
                )
              </span>
            </button>
          ) : (
            <button
              onClick={handleExtensionCrawl}
              disabled={isScraping}
              className="flex items-center gap-1 rounded bg-indigo-600/90 hover:bg-indigo-600 px-2.5 py-1 text-[11px] font-sans font-bold text-white transition-colors disabled:opacity-50 cursor-pointer"
              title="Extension sẽ mở tab LinkedIn theo bộ lọc hiện tại và cào tự động"
            >
              {isScraping ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Đang kết nối Extension...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="h-3 w-3" />
                  <span>Cào LinkedIn qua Extension</span>
                </>
              )}
            </button>
          )}

          <div className="text-slate-600 hidden sm:inline">|</div>
          <div>
            Số lượng: <span className="text-white font-bold">{totalCount}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div>
            HCM: <span className="text-indigo-400 font-bold">{hcmCount}</span> / Đồng Nai:{" "}
            <span className="text-amber-400 font-bold">{dnCount}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div>
            Độ khớp TB: <span className="text-emerald-400 font-bold">{avgMatch}%</span>
          </div>
          {statusCounts.SAVED > 0 && (
            <>
              <div className="text-slate-600">|</div>
              <div className="flex items-center gap-1">
                <Bookmark className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400 font-bold">{statusCounts.SAVED}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Scrape status alert */}
      {scrapeMsg && (
        <div
          className={`flex items-center gap-2 rounded border p-2 text-xs font-mono ${
            scrapeMsg.type === "success"
              ? "border-emerald-800 bg-emerald-950/60 text-emerald-300"
              : "border-rose-800 bg-rose-950/60 text-rose-300"
          }`}
        >
          {scrapeMsg.type === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{scrapeMsg.text}</span>
          {crawlState.isRunning && (
            <span className="ml-auto shrink-0 text-indigo-300">
              Trang {crawlState.pageNumber} · đã lưu {crawlState.crawledCount}
            </span>
          )}
        </div>
      )}

      {/* Filter Toolbar full width */}
      <JobFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        totalResults={jobs.length}
        statusCounts={statusCounts}
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded border border-rose-900/60 bg-rose-950/40 p-2 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading & Empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
          <span>Đang tính toán độ khớp năng lực với dữ liệu việc làm thực tế...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/50 py-12 px-4 text-center space-y-3">
          <MapPin className="h-8 w-8 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-200">Chưa có dữ liệu việc làm phù hợp với bộ lọc</h3>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            Hãy thử điều chỉnh lại bộ lọc hoặc thu thập thêm các vị trí tuyển dụng thực tế bằng các cách sau:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left mt-2">
            <div className="rounded border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-900/80 text-center text-[10px] leading-4 text-white">1</span>
                <span>Cào Từ Dashboard</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Bấm &quot;Cào LinkedIn qua Extension&quot; ở góc trên — Extension tự mở tab LinkedIn đúng bộ lọc hiện tại và cào toàn bộ các trang.
              </p>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-emerald-900/80 text-center text-[10px] leading-4 text-white">2</span>
                <span>Cào Trực Tiếp Trên LinkedIn</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mở sẵn tab LinkedIn rồi bấm nút nổi &quot;Cào Tự Động Tất Cả Trang&quot; hoặc &quot;Đồng bộ việc làm này&quot;.
              </p>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-purple-900/80 text-center text-[10px] leading-4 text-white">3</span>
                <span>Dán Bản JD</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Vào mục &quot;Phân tích CV & JD&quot; để dán nội dung tuyển dụng và chấm điểm tương thích.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() =>
                setFilters({
                  keyword: "",
                  company: "",
                  location: "ALL",
                  roleCategory: "ALL",
                  seniority: "ALL",
                  datePosted: "ALL",
                  workMode: "ALL",
                  applyType: "ALL",
                  isEasyApply: false,
                  competitionLevel: "ALL",
                  minExperienceYears: 0,
                  minSalaryVND: 0,
                  minScore: 0,
                  hasSalary: false,
                  userStatus: "ALL",
                })
              }
              className="rounded bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              Đặt lại toàn bộ bộ lọc
            </button>

            <Link
              href="/custom-analyzer"
              className="rounded border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-purple-400" />
              <span>Phân tích theo CV & JD riêng</span>
            </Link>
          </div>
        </div>
      ) : (
        <JobTableView
          jobs={jobs}
          onSelect={(j) => setSelectedJob(j)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
