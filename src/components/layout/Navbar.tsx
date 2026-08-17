"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Table, FileSearch, UserCheck, BookmarkCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

export const Navbar: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Bảng Việc Làm", shortLabel: "Việc Làm", icon: Table },
    { href: "/custom-analyzer", label: "Tìm Việc Theo CV", shortLabel: "Theo CV", icon: FileSearch },
    { href: "/profile", label: "Hồ Sơ Năng Lực", shortLabel: "Hồ Sơ", icon: UserCheck },
    { href: "/applications", label: "Ứng Tuyển", shortLabel: "Theo Dõi", icon: BookmarkCheck },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md">
      <div className="w-full flex items-center justify-between px-3 py-2 sm:px-5 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <BrandLogo size="md" className="group-hover:border-indigo-400 group-hover:scale-105 transition-transform transition-colors" />
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

      </div>
    </header>
  );
};
