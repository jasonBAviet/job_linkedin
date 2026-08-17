import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/core/services/job-service";
import { profileRepository } from "@/core/repositories/profile-repository";


// Route chạm database qua SSH tunnel -> không được prerender lúc build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const apps = await jobService.getApplications();
    const allJobs = (await jobService.getScoredJobs()).jobs;

    const populated = apps.map((app) => {
      const job = allJobs.find((j) => j.id === app.jobId);
      return {
        ...app,
        jobDetails: job || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi lấy danh sách ứng tuyển", error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, status, notes } = body;

    if (!jobId) {
      return NextResponse.json({ success: false, message: "Mã việc làm (jobId) là bắt buộc" }, { status: 400 });
    }

    const saved = await jobService.trackJobApplication(jobId, status || "SAVED", notes);

    return NextResponse.json({
      success: true,
      message: "Cập nhật trạng thái ứng tuyển thành công",
      data: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi cập nhật trạng thái ứng tuyển", error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ success: false, message: "Thiếu jobId" }, { status: 400 });
    }

    const removed = await profileRepository.removeApplication(jobId);
    return NextResponse.json({
      success: true,
      removed,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi xóa mục ứng tuyển", error: String(error) },
      { status: 500 }
    );
  }
}
