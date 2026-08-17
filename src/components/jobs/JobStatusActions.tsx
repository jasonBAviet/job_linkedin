"use client";

import React from "react";
import { Bookmark, CheckCircle, EyeOff } from "lucide-react";
import { JobUserStatus } from "@/core/dtos/job.dto";

interface JobStatusActionsProps {
  jobId: string;
  currentStatus: JobUserStatus;
  onStatusChange: (jobId: string, status: JobUserStatus) => void;
  size?: "sm" | "md";
}

const STATUS_CONFIG: {
  status: JobUserStatus;
  label: string;
  icon: React.ElementType;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    status: "SAVED",
    label: "Luu",
    icon: Bookmark,
    activeClass: "bg-amber-950/80 text-amber-300 border-amber-600 shadow-amber-600/20",
    inactiveClass: "text-slate-400 border-slate-700 hover:text-amber-300 hover:bg-amber-950/40 hover:border-amber-700",
  },
  {
    status: "VIEWED",
    label: "Da xem",
    icon: CheckCircle,
    activeClass: "bg-indigo-950/80 text-indigo-300 border-indigo-600 shadow-indigo-600/20",
    inactiveClass: "text-slate-400 border-slate-700 hover:text-indigo-300 hover:bg-indigo-950/40 hover:border-indigo-700",
  },
  {
    status: "HIDDEN",
    label: "An",
    icon: EyeOff,
    activeClass: "bg-rose-950/80 text-rose-300 border-rose-600 shadow-rose-600/20",
    inactiveClass: "text-slate-400 border-slate-700 hover:text-rose-300 hover:bg-rose-950/40 hover:border-rose-700",
  },
];

export const JobStatusActions: React.FC<JobStatusActionsProps> = ({
  jobId,
  currentStatus,
  onStatusChange,
  size = "sm",
}) => {
  const handleClick = (targetStatus: JobUserStatus) => {
    // Bam lai trang thai dang active -> quay ve NEW (huy danh dau)
    const newStatus = currentStatus === targetStatus ? "NEW" : targetStatus;
    onStatusChange(jobId, newStatus);
  };

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const btnPadding = size === "sm" ? "p-1" : "p-1.5";
  const fontSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className="flex items-center gap-0.5">
      {STATUS_CONFIG.map(({ status, label, icon: Icon, activeClass, inactiveClass }) => {
        const isActive = currentStatus === status;
        return (
          <button
            key={status}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick(status);
            }}
            title={isActive ? `Huy ${label}` : label}
            className={`${btnPadding} rounded border transition-all cursor-pointer flex items-center gap-0.5 shadow-sm ${
              isActive ? activeClass : inactiveClass
            }`}
          >
            <Icon className={`${iconSize} ${isActive ? "fill-current" : ""}`} />
            {size === "md" && (
              <span className={`${fontSize} font-semibold`}>{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
