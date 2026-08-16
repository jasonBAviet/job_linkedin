"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { RadarMetric } from "@/core/dtos/scoring.dto";

interface SkillRadarChartProps {
  data: RadarMetric[];
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-sm flex flex-col items-center">
      <div className="w-full text-left border-b border-slate-800 pb-2 mb-2">
        <h3 className="text-sm font-bold text-slate-200">
          So Khớp Kỹ Năng (Skill Radar)
        </h3>
        <p className="text-[11px] text-slate-400">
          So sánh năng lực thực tế với yêu cầu của vị trí tuyển dụng
        </p>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={{ fill: "#64748b", fontSize: 9 }} />
            <Radar
              name="Yêu cầu vị trí"
              dataKey="required"
              stroke="#818cf8"
              fill="#818cf8"
              fillOpacity={0.25}
            />
            <Radar
              name="Năng lực hồ sơ bạn"
              dataKey="candidate"
              stroke="#34d399"
              fill="#34d399"
              fillOpacity={0.45}
            />
            <Tooltip
              formatter={(value: any) => [`${value} / 100 điểm`]}
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#f8fafc",
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "6px", fontSize: "11px" }}
              iconType="circle"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
