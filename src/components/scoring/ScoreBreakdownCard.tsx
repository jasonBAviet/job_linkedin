import React from "react";
import { ScoreBreakdown } from "@/core/dtos/scoring.dto";
import { Award, Code2, Briefcase, MapPin, GraduationCap } from "lucide-react";

interface ScoreBreakdownCardProps {
  breakdown: ScoreBreakdown;
}

export const ScoreBreakdownCard: React.FC<ScoreBreakdownCardProps> = ({ breakdown }) => {
  const items = [
    {
      title: "Kỹ năng Cốt lõi (Core BA/DA)",
      score: breakdown.coreSkillsScore,
      max: 50,
      icon: Code2,
      description: "Requirements, BPMN, SQL, Data Modeling, Thống kê...",
      color: "bg-indigo-500",
      lightColor: "bg-indigo-950/80 text-indigo-400 border border-indigo-800/60",
    },
    {
      title: "Công cụ & Phần mềm (Tools)",
      score: breakdown.secondarySkillsScore,
      max: 20,
      icon: Award,
      description: "Power BI, Jira, Postman, Figma, Python, Excel...",
      color: "bg-blue-500",
      lightColor: "bg-blue-950/80 text-blue-400 border border-blue-800/60",
    },
    {
      title: "Cấp bậc & Kinh nghiệm (Seniority)",
      score: breakdown.seniorityScore,
      max: 15,
      icon: Briefcase,
      description: "Số năm kinh nghiệm & cấp bậc Senior/Lead",
      color: "bg-emerald-500",
      lightColor: "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60",
    },
    {
      title: "Khu vực & Địa điểm (Location Fit)",
      score: breakdown.locationScore,
      max: 10,
      icon: MapPin,
      description: "TP. Hồ Chí Minh & Đồng Nai (KCN Biên Hòa, Long Thành)",
      color: "bg-amber-500",
      lightColor: "bg-amber-950/80 text-amber-400 border border-amber-800/60",
    },
    {
      title: "Chứng chỉ & Học vấn",
      score: breakdown.certificationScore,
      max: 5,
      icon: GraduationCap,
      description: "Chứng chỉ BABOK (IIBA), Scrum, Power BI...",
      color: "bg-purple-500",
      lightColor: "bg-purple-950/80 text-purple-400 border border-purple-800/60",
    },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-sm font-bold text-slate-200">
          Cơ Cấu Điểm Trọng Số (Chuẩn BABOK)
        </h3>
        <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
          Tổng: {breakdown.totalScore} / 100 đ
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const percentage = Math.round((item.score / item.max) * 100);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <div className={`p-1 rounded ${item.lightColor}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span>{item.title}</span>
                </div>
                <div className="font-mono font-bold text-slate-200">
                  {item.score} <span className="text-slate-500 font-normal">/ {item.max}đ</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${item.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-400 font-mono">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
