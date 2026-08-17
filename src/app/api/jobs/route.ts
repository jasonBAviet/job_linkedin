import { NextRequest, NextResponse } from "next/server";
import { ApplyType, DatePostedFilter, JobRoleCategory, JobUserStatus, WorkLocation, WorkMode } from "@/core/dtos/job.dto";
import { jobService } from "@/core/services/job-service";
import { jobStatusRepository } from "@/core/repositories/job-status-repository";


// Route chạm database qua SSH tunnel -> không được prerender lúc build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") || undefined;
    const company = searchParams.get("company") || undefined;
    const location = (searchParams.get("location") as WorkLocation | "ALL") || "ALL";
    const roleCategory = (searchParams.get("roleCategory") as JobRoleCategory | "ALL") || "ALL";
    const seniority = (searchParams.get("seniority") as any) || "ALL";
    const datePosted = (searchParams.get("datePosted") as DatePostedFilter | "ALL") || "ALL";
    const workMode = (searchParams.get("workMode") as WorkMode | "ALL") || "ALL";
    const applyType = (searchParams.get("applyType") as ApplyType | "ALL") || "ALL";
    const isEasyApply = searchParams.get("isEasyApply") === "true";
    const competitionLevel = (searchParams.get("competitionLevel") as any) || "ALL";
    const minExperienceYears = searchParams.get("minExperienceYears") ? Number(searchParams.get("minExperienceYears")) : undefined;
    const minSalaryVND = searchParams.get("minSalaryVND") ? Number(searchParams.get("minSalaryVND")) : undefined;
    const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
    const hasSalary = searchParams.get("hasSalary") === "true";
    const userStatus = (searchParams.get("userStatus") as JobUserStatus | "ALL") || "ALL";

    const result = await jobService.getScoredJobs({
      keyword,
      company,
      location,
      roleCategory,
      seniority,
      datePosted,
      workMode,
      applyType,
      isEasyApply: isEasyApply || undefined,
      competitionLevel: competitionLevel !== "ALL" ? competitionLevel : undefined,
      minExperienceYears,
      minSalaryVND,
      minScore,
      hasSalary,
      userStatus,
    });

    // Lấy toàn bộ status một lần rồi tra cứu tại chỗ — tránh N truy vấn qua SSH tunnel
    const [statusMap, statusCounts] = await Promise.all([
      jobStatusRepository.getAll(),
      jobStatusRepository.getCounts(),
    ]);
    const jobsWithStatus = result.jobs.map((job) => ({
      ...job,
      userStatus: statusMap[job.id]?.status || "NEW",
    }));

    return NextResponse.json({
      success: true,
      data: jobsWithStatus,
      total: result.totalCount,
      statusCounts,
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
