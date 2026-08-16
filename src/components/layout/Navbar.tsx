"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Table, FileSearch, UserCheck, BookmarkCheck, RefreshCw } from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [isScraping, setIsScraping] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const navLinks = [
    { href: "/", label: "Bảng Việc Làm", shortLabel: "Việc Làm", icon: Table },
    { href: "/custom-analyzer", label: "Tìm Việc Theo CV", shortLabel: "Theo CV", icon: FileSearch },
    { href: "/profile", label: "Hồ Sơ Năng Lực", shortLabel: "Hồ Sơ", icon: UserCheck },
    { href: "/applications", label: "Ứng Tuyển", shortLabel: "Theo Dõi", icon: BookmarkCheck },
  ];

  const handleScrape = async () => {
    try {
      setIsScraping(true);
      setMsg(null);
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "ALL" }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`+${data.addedCount} JD`);
        setTimeout(() => {
          setMsg(null);
          window.location.reload();
        }, 1200);
      }
    } catch {
      setMsg("Lỗi cào");
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md">
      <div className="w-full flex items-center justify-between px-3 py-2 sm:px-5 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded bg-indigo-600 text-white font-mono font-bold text-xs shrink-0">
            BA
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs sm:text-sm font-black tracking-tight text-white">
              JobHunter
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono text-indigo-400 hidden xs:inline-block">
              HCM & Đồng Nai
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 sm:gap-1.5 rounded px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                <span className="hidden sm:inline">{link.label}</span>
                <span className="inline sm:hidden">{link.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {msg && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              {msg}
            </span>
          )}
          <button
            onClick={handleScrape}
            disabled={isScraping}
            className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            title="Cào bổ sung tin tuyển dụng LinkedIn mới"
          >
            <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-400 ${isScraping ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{isScraping ? "Đang cào..." : "Cào LinkedIn"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
