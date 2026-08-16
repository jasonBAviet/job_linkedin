import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/core/services/job-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, company, rawText, location, url } = body;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { success: false, message: "Nội dung mô tả công việc (JD) không được để trống." },
        { status: 400 }
      );
    }

    const scoredJob = jobService.scoreCustomJD(
      title || "Business / Data Analyst",
      company || "Doanh nghiệp",
      rawText,
      location || "HO_CHI_MINH",
      url || ""
    );

    return NextResponse.json({
      success: true,
      message: "Chấm điểm và phân tích JD hoàn tất.",
      data: scoredJob,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi trong quá trình phân tích JD tùy biến", error: String(error) },
      { status: 500 }
    );
  }
}
