import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/core/services/job-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const location = body.location || "ALL";
    const roleCategory = body.roleCategory || "ALL";
    const keywords = body.keywords || "";

    const result = await jobService.scrapeAndIngestJobs({
      location,
      roleCategory,
      keywords,
    });

    return NextResponse.json({
      success: true,
      message: `Đã thu thập thành công dữ liệu việc làm từ LinkedIn cho khu vực ${location === "DONG_NAI" ? "Đồng Nai" : location === "HO_CHI_MINH" ? "TP.HCM" : "TP.HCM & Đồng Nai"}.`,
      addedCount: result.addedCount,
      totalJobs: result.totalJobs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi trong quá trình thu thập dữ liệu việc làm LinkedIn", error: String(error) },
      { status: 500 }
    );
  }
}
