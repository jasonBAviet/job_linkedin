"use client";

import React from "react";
import { Users, Flame } from "lucide-react";
import { CompetitionLevel } from "@/core/dtos/job.dto";

interface CompetitionBadgeProps {
  competitionLevel?: CompetitionLevel;
  applicantCountText?: string;
  isPromoted?: boolean;
  responsesManagedOffLinkedIn?: boolean;
  showSubBadges?: boolean;
  size?: "sm" | "md";
}

export const CompetitionBadge: React.FC<CompetitionBadgeProps> = ({
  competitionLevel = "UNKNOWN",
  applicantCountText,
  isPromoted = false,
  responsesManagedOffLinkedIn = false,
  showSubBadges = true,
  size = "sm",
}) => {
  const isSm = size === "sm";

  return (
    <div className="flex flex-col gap-0.5">
      {competitionLevel === "LOW" && (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 w-fit ${
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
          }`}
        >
          <Users className={isSm ? "h-2.5 w-2.5" : "h-3 w-3"} />
          <span>{applicantCountText || "Ít cạnh tranh (<25)"}</span>
        </span>
      )}

      {competitionLevel === "MEDIUM" && (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold bg-amber-950/70 text-amber-300 border border-amber-800/80 w-fit ${
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
          }`}
        >
          <Users className={isSm ? "h-2.5 w-2.5" : "h-3 w-3"} />
          <span>{applicantCountText || "Cạnh tranh vừa"}</span>
        </span>
      )}

      {competitionLevel === "HIGH" && (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold bg-rose-950/70 text-rose-300 border border-rose-800/80 w-fit ${
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
          }`}
        >
          <Flame className={isSm ? "h-2.5 w-2.5 text-rose-400" : "h-3 w-3 text-rose-400"} />
          <span>{applicantCountText || "Cạnh tranh cao (>100)"}</span>
        </span>
      )}

      {competitionLevel === "UNKNOWN" && (
        <span className="text-[10px] text-slate-500 font-mono">
          Chưa công bố
        </span>
      )}

      {showSubBadges && (isPromoted || responsesManagedOffLinkedIn) && (
        <div className="flex items-center gap-1 flex-wrap">
          {isPromoted && (
            <span className="text-[9px] font-mono text-purple-300 bg-purple-950/60 border border-purple-800/60 rounded px-1">
              Promoted
            </span>
          )}
          {responsesManagedOffLinkedIn && (
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded px-1">
              Ngoài LinkedIn
            </span>
          )}
        </div>
      )}
    </div>
  );
};
