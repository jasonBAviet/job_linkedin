import { NextRequest, NextResponse } from "next/server";
import { JobUserStatus } from "@/core/dtos/job.dto";
import { jobStatusRepository } from "@/core/repositories/job-status-repository";


// Route chạm database qua SSH tunnel -> không được prerender lúc build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const VALID_STATUSES: JobUserStatus[] = ["NEW", "SAVED", "VIEWED", "HIDDEN"];

/** GET: Tra ve toan bo trang thai va so dem */
export async function GET() {
  try {
    const statusMap = await jobStatusRepository.getAll();
    const counts = await jobStatusRepository.getCounts();

    return NextResponse.json({
      success: true,
      data: statusMap,
      counts,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Loi khi doc trang thai job", error: String(error) },
      { status: 500 }
    );
  }
}

/** POST: Cap nhat trang thai cho 1 job */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, status } = body as { jobId?: string; status?: JobUserStatus };

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, message: "Thieu jobId" },
        { status: 400 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Trang thai khong hop le. Chap nhan: NEW, SAVED, VIEWED, HIDDEN" },
        { status: 400 }
      );
    }

    await jobStatusRepository.setStatus(jobId, status);
    const counts = await jobStatusRepository.getCounts();

    return NextResponse.json({
      success: true,
      jobId,
      status,
      counts,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Loi khi cap nhat trang thai job", error: String(error) },
      { status: 500 }
    );
  }
}
