import React from "react";
import { CheckCircle2, ShieldCheck, MapPin } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="text-sm font-semibold text-slate-800">
            Hệ Thống Phân Tích & Chấm Điểm Việc Làm BA / DA Chuẩn BABOK
          </p>
          <p className="text-xs text-slate-500">
            Dữ liệu tuyển dụng định vị chuyên biệt cho TP. Hồ Chí Minh & Đồng Nai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
            <span>Khu vực: TP.HCM, KCN Đồng Nai (Biên Hòa, Long Thành, Amata)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Tuân thủ BMAD & BABOK v3</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            <span>React 19 / Next.js 15 Fullstack</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
