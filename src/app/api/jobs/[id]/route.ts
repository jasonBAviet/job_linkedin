import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/core/services/job-service";


// Route chạm database qua SSH tunnel -> không được prerender lúc build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobWithScore = await jobService.getJobDetailWithScore(id);

    if (!jobWithScore) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy việc làm với mã ID tương ứng." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobWithScore,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi lấy thông tin chi tiết việc làm", error: String(error) },
      { status: 500 }
    );
  }
}
