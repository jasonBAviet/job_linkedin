import { NextRequest, NextResponse } from "next/server";
import { jobRepository } from "@/core/repositories/job-repository";
import { profileRepository } from "@/core/repositories/profile-repository";
import { scoringService } from "@/core/services/scoring-service";
import { jobMappingService, RawIngestedJob } from "@/core/services/job-mapping-service";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Tiếp nhận dữ liệu thô: hỗ trợ mảng jobs, đối tượng đơn job hoặc body thô
    const rawList: RawIngestedJob[] = Array.isArray(body.jobs)
      ? body.jobs
      : body.job
      ? [body.job]
      : Array.isArray(body)
      ? body
      : [body];

    if (!rawList || rawList.length === 0) {
      return NextResponse.json(
        { success: false, message: "Dữ liệu thô không được rỗng" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const currentProfile = profileRepository.getProfile();
    const processedJobs: any[] = [];

    for (const raw of rawList) {
      // Giai đoạn 2: Ánh xạ và chuẩn hóa dữ liệu thô
      const mappedJob = jobMappingService.mapRawToJobPosting(raw);

      // Lưu vào Repository
      const savedJob = jobRepository.addJob(mappedJob);

      // Đánh giá và tính điểm tương thích CV (Match Score)
      const scoreResult = scoringService.calculateMatchScore(currentProfile, savedJob);

      processedJobs.push({
        ...savedJob,
        scoreResult,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Đã tiếp nhận và ánh xạ thành công ${processedJobs.length} việc làm vào hệ thống`,
        data: processedJobs,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Lỗi trong quá trình ánh xạ và xử lý dữ liệu việc làm",
        error: String(error),
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
