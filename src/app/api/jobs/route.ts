import { NextRequest, NextResponse } from "next/server";
import { JobRoleCategory, SeniorityLevel, WorkLocation } from "@/core/dtos/job.dto";
import { jobService } from "@/core/services/job-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") || undefined;
    const location = (searchParams.get("location") as WorkLocation | "ALL") || "ALL";
    const roleCategory = (searchParams.get("roleCategory") as JobRoleCategory | "ALL") || "ALL";
    const seniority = (searchParams.get("seniority") as any) || "ALL";
    const minExperienceYears = searchParams.get("minExperienceYears") ? Number(searchParams.get("minExperienceYears")) : undefined;
    const minSalaryVND = searchParams.get("minSalaryVND") ? Number(searchParams.get("minSalaryVND")) : undefined;
    const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
    const hasSalary = searchParams.get("hasSalary") === "true";

    const result = jobService.getScoredJobs({
      keyword,
      location,
      roleCategory,
      seniority,
      minExperienceYears,
      minSalaryVND,
      minScore,
      hasSalary,
    });

    return NextResponse.json({
      success: true,
      data: result.jobs,
      total: result.totalCount,
      profileSummary: {
        targetRole: result.profile.targetRole,
        seniority: result.profile.currentSeniority,
        skillsCount: result.profile.skills.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi lấy danh sách việc làm", error: String(error) },
      { status: 500 }
    );
  }
}
