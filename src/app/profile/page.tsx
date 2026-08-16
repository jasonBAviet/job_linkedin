"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Save, RefreshCw, AlertCircle } from "lucide-react";
import { CandidateProfile } from "@/core/dtos/profile.dto";
import { SkillMatrixEditor } from "@/components/profile/SkillMatrixEditor";

export default function ProfilePage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Không thể tải thông tin hồ sơ ứng viên." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (updated: CandidateProfile) => {
    try {
      setIsSaving(true);
      setStatusMsg(null);

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setStatusMsg({ type: "success", text: "Đã lưu hồ sơ ứng viên thành công!" });
        setTimeout(() => setStatusMsg(null), 2500);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Lỗi trong quá trình lưu hồ sơ." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExtractFromCV = async (cvText: string) => {
    try {
      setIsExtracting(true);
      setStatusMsg(null);

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawResumeText: cvText }),
      });

      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setStatusMsg({
          type: "success",
          text: `Đã trích xuất ${data.extractedCount} kỹ năng mới từ CV của bạn!`,
        });
        setTimeout(() => setStatusMsg(null), 2500);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Lỗi khi trích xuất kỹ năng từ CV." });
    } finally {
      setIsExtracting(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-400 mb-2" />
        <p>Đang tải hồ sơ năng lực...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-2.5 sm:px-4 lg:px-6 py-3 space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-indigo-400" />
          <h1 className="text-xs sm:text-sm font-bold text-slate-100">
            Hồ Sơ Năng Lực Ứng Viên (Senior BA / DA)
          </h1>
        </div>
        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
          Trọng số dùng để tính điểm độ khớp JD
        </span>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded border p-2 text-xs font-mono ${
            statusMsg.type === "success"
              ? "border-emerald-800 bg-emerald-950/60 text-emerald-300"
              : "border-rose-800 bg-rose-950/60 text-rose-300"
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Grid full-width */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 w-full">
        {/* Basic info form */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4 shadow-sm space-y-2.5 text-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              Thông Tin Cơ Bản
            </h3>

            <div>
              <label className="block text-slate-400 mb-1 font-mono">Họ và Tên:</label>
              <input
                type="text"
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1 font-mono">Vị trí mục tiêu:</label>
                <select
                  value={profile.targetRole}
                  onChange={(e) => setProfile({ ...profile, targetRole: e.target.value as any })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="BUSINESS_ANALYST">Business Analyst (BA)</option>
                  <option value="DATA_ANALYST">Data Analyst (DA)</option>
                  <option value="HYBRID_BA_DA">Hybrid BA / DA</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono">Cấp bậc:</label>
                <select
                  value={profile.currentSeniority}
                  onChange={(e) => setProfile({ ...profile, currentSeniority: e.target.value as any })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="SENIOR">Senior (3-5 năm)</option>
                  <option value="LEAD_MANAGER">Lead / Manager (5+ năm)</option>
                  <option value="MIDDLE">Middle</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1 font-mono">Số năm KN:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={profile.yearsOfTotalExperience}
                  onChange={(e) => setProfile({ ...profile, yearsOfTotalExperience: Number(e.target.value) })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono">Lương kỳ vọng (VNĐ):</label>
                <input
                  type="number"
                  step={1000000}
                  value={profile.expectedSalaryVND || 0}
                  onChange={(e) => setProfile({ ...profile, expectedSalaryVND: Number(e.target.value) })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-emerald-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono">Khu vực ưu tiên:</label>
              <div className="flex gap-4 text-xs font-medium text-slate-200 mt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.preferredLocations.includes("HO_CHI_MINH")}
                    onChange={(e) => {
                      const locs = e.target.checked
                        ? [...profile.preferredLocations, "HO_CHI_MINH" as const]
                        : profile.preferredLocations.filter((l) => l !== "HO_CHI_MINH");
                      setProfile({ ...profile, preferredLocations: locs });
                    }}
                    className="rounded text-indigo-600 bg-slate-950 border-slate-700"
                  />
                  <span>TP. Hồ Chí Minh</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.preferredLocations.includes("DONG_NAI")}
                    onChange={(e) => {
                      const locs = e.target.checked
                        ? [...profile.preferredLocations, "DONG_NAI" as const]
                        : profile.preferredLocations.filter((l) => l !== "DONG_NAI");
                      setProfile({ ...profile, preferredLocations: locs });
                    }}
                    className="rounded text-indigo-600 bg-slate-950 border-slate-700"
                  />
                  <span>Đồng Nai (KCN)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-mono">Học vấn & Bằng cấp:</label>
              <input
                type="text"
                value={profile.education || ""}
                onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                placeholder="Ví dụ: Cử nhân Hệ thống Thông tin Quản lý"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSaveProfile(profile)}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 rounded bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5 text-emerald-300" />
              <span>{isSaving ? "Đang lưu..." : "Lưu Thông Tin Cá Nhân"}</span>
            </button>
          </div>
        </div>

        {/* Skill Matrix Editor */}
        <div className="lg:col-span-7">
          <SkillMatrixEditor
            profile={profile}
            onSave={handleSaveProfile}
            onExtractFromCV={handleExtractFromCV}
            isExtracting={isExtracting}
          />
        </div>
      </div>
    </div>
  );
}
