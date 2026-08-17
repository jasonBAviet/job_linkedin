import { NextRequest, NextResponse } from "next/server";
import { jobRepository } from "@/core/repositories/job-repository";
import { profileRepository } from "@/core/repositories/profile-repository";
import { scoringService } from "@/core/services/scoring-service";
import { IngestError, jobMappingService, RawIngestedJob } from "@/core/services/job-mapping-service";


// Route chạm database qua SSH tunnel -> không được prerender lúc build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

    // Xử lý gói tin kiểm tra kết nối (Ping Test / Health Check) từ Extension
    if (
      rawList.length === 1 &&
      (rawList[0].rawTitle === "PING_TEST" || rawList[0].rawCompany === "HEALTH_CHECK")
    ) {
      return NextResponse.json(
        { success: true, message: "Máy chủ sẵn sàng tiếp nhận dữ liệu thực tế.", isPing: true },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const currentProfile = await profileRepository.getProfile();
    const processedJobs: any[] = [];
    const rejected: Array<{ index: number; code: string; message: string; missingFields: string[] }> = [];
    // Tách riêng ba kết cục để extension báo đúng việc đã xảy ra, thay vì gộp hết
    // vào "imported" rồi hiện số việc làm mới nhiều hơn thực tế.
    let inserted = 0;
    let overwritten = 0;
    let skipped = 0;

    for (let i = 0; i < rawList.length; i++) {
      const raw = rawList[i];
      if (raw.rawTitle === "PING_TEST" || raw.rawCompany === "HEALTH_CHECK") {
        continue;
      }

      try {
        // Giai đoạn 2: Ánh xạ và chuẩn hóa dữ liệu thô.
        // Thiếu dữ liệu thật -> IngestError, bản ghi bị TỪ CHỐI thay vì bịa nội dung.
        const mappedJob = jobMappingService.mapRawToJobPosting(raw);
        // Giai đoạn 3: khử trùng lặp 3 tầng + luật ngày đăng (xem jobRepository.upsertJob)
        const { job: savedJob, outcome, reason } = await jobRepository.upsertJob(mappedJob);
        const scoreResult = scoringService.calculateMatchScore(currentProfile, savedJob);

        if (outcome === "INSERTED") inserted++;
        else if (outcome === "OVERWRITTEN") overwritten++;
        else skipped++;

        processedJobs.push({ ...savedJob, scoreResult, outcome, reason });
      } catch (err) {
        if (err instanceof IngestError) {
          rejected.push({
            index: i,
            code: err.code,
            message: err.message,
            missingFields: err.missingFields,
          });
          continue;
        }
        // Một bản ghi hỏng không được làm mất những bản đã ghi thành công trước đó
        // trong cùng lô: ghi nhận rồi đi tiếp thay vì 500 toàn bộ request.
        rejected.push({
          index: i,
          code: "PERSIST_FAILED",
          message: `Không lưu được bản ghi: ${String((err as Error)?.message || err)}`,
          missingFields: [],
        });
      }
    }

    // Không nhận được bản ghi nào mà lại có bản bị từ chối -> 422 để extension báo rõ lý do
    if (processedJobs.length === 0 && rejected.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: rejected[0].message,
          imported: 0,
          rejected: rejected.length,
          errors: rejected,
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const parts = [`${inserted} mới`];
    if (overwritten > 0) parts.push(`${overwritten} cập nhật (ngày đăng mới hơn)`);
    if (skipped > 0) parts.push(`${skipped} bỏ qua (đã có, cùng ngày đăng)`);
    if (rejected.length > 0) parts.push(`${rejected.length} từ chối`);

    return NextResponse.json(
      {
        success: true,
        message: `Đã xử lý ${processedJobs.length} việc làm: ${parts.join(", ")}`,
        // `imported` giữ nguyên tên cũ để extension không vỡ, nhưng nay chỉ đếm bản
        // ghi THÊM MỚI — đó mới là con số người dùng quan tâm.
        imported: inserted,
        inserted,
        overwritten,
        skipped,
        processed: processedJobs.length,
        rejected: rejected.length,
        errors: rejected,
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
