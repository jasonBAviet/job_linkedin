"use client";

import React, { useState, useEffect } from "react";
import { BookmarkCheck, Building2, MapPin, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { ApplicationRecord } from "@/core/dtos/profile.dto";
import { JobWithScore } from "@/core/services/job-service";
import { MatchScoreBadge } from "@/components/scoring/MatchScoreBadge";

interface PopulatedApplication extends ApplicationRecord {
  jobDetails: JobWithScore | null;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<PopulatedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/applications");
      const data = await res.json();
      if (data.success) {
        setApplications(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleUpdateStatus = async (jobId: string, status: string) => {
    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status }),
      });
      fetchApplications();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await fetch(`/api/applications?jobId=${jobId}`, {
        method: "DELETE",
      });
      setApplications((prev) => prev.filter((a) => a.jobId !== jobId));
    } catch {
      // ignore
    }
  };

  const filtered = applications.filter((app) => {
    if (statusFilter === "ALL") return true;
    return app.status === statusFilter;
  });

  return (
    <div className="w-full px-2.5 sm:px-4 lg:px-6 py-3 space-y-3 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-indigo-400" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100">
            Theo Dõi Tiến Trình Ứng Tuyển (Application Pipeline)
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả ({applications.length})</option>
            <option value="SAVED">Đã lưu</option>
            <option value="APPLIED">Đã nộp</option>
            <option value="SCREENING">Sơ loại CV</option>
            <option value="INTERVIEW">Phỏng vấn</option>
            <option value="OFFER">Nhận Offer</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
          <span>Đang tải danh sách theo dõi...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 py-12 px-4 text-center">
          <BookmarkCheck className="h-8 w-8 text-slate-600 mb-2" />
          <h3 className="text-xs font-bold text-slate-300">Chưa có việc làm nào trong danh sách theo dõi</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Hãy khám phá các cơ hội Senior tại bảng việc làm chính và lưu lại.
          </p>
        </div>
      ) : (
        <div className="space-y-2 w-full">
          {filtered.map((app) => {
            const job = app.jobDetails;
            const score = app.matchScoreAtApply || job?.scoreResult?.totalScore || 0;

            return (
              <div
                key={app.id}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-3 shadow-xs hover:border-slate-700 transition-all gap-2.5"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white border border-slate-700 overflow-hidden mt-0.5 p-0.5">
                    {job?.companyLogo ? (
                      <img
                        src={job.companyLogo}
                        alt={job.company}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-100 truncate">{job?.title || "Vị trí tuyển dụng"}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-300">{job?.company}</span>
                      <span className="text-slate-600">•</span>
                      <span className="flex items-center gap-0.5 text-indigo-400">
                        <MapPin className="h-2.5 w-2.5" />
                        {job?.locationDetails || (job?.location === "DONG_NAI" ? "Đồng Nai" : "TP.HCM")}
                      </span>
                      {job?.salaryRange && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {job.salaryRange.display}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <MatchScoreBadge score={score} size="sm" />

                  <select
                    value={app.status}
                    onChange={(e) => handleUpdateStatus(app.jobId, e.target.value)}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-mono font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="SAVED">Đã lưu</option>
                    <option value="APPLIED">Đã nộp</option>
                    <option value="SCREENING">Sơ loại CV</option>
                    <option value="INTERVIEW">Phỏng vấn</option>
                    <option value="OFFER">Nhận Offer</option>
                  </select>

                  {job?.linkedinUrl && (
                    <a
                      href={job.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-indigo-400 transition-colors"
                      title="Mở link LinkedIn"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(app.jobId)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Xóa khỏi danh sách"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
