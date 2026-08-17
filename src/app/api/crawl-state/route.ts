import { NextRequest, NextResponse } from "next/server";
import { crawlSessionRepository } from "@/core/repositories/crawl-session-repository";

/**
 * Đồng bộ tiến trình phiên cào từ Extension về máy chủ.
 *
 * Đây là TELEMETRY: mất dữ liệu ở đây chỉ mất lịch sử, không mất khả năng tiếp tục
 * cào — nguồn resume thật nằm ở chrome.storage.local của extension.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");

    if (sessionId) {
      const session = await crawlSessionRepository.getSession(sessionId);
      return NextResponse.json({ success: true, data: session }, { headers: CORS_HEADERS });
    }

    const [resumable, recent] = await Promise.all([
      crawlSessionRepository.getResumableSession(),
      crawlSessionRepository.getRecentSessions(20),
    ]);
    return NextResponse.json(
      { success: true, resumable, data: recent },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi đọc trạng thái phiên cào", error: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const s = body.session || body;

    if (!s || !s.sessionId) {
      return NextResponse.json(
        { success: false, message: "Thiếu sessionId" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Dọn phiên treo trước khi ghi phiên mới
    if (s.status === "RUNNING" && (s.pageIndex ?? 0) === 0) {
      await crawlSessionRepository.reapStaleSessions(30);
    }

    const saved = await crawlSessionRepository.upsertProgress({
      sessionId: s.sessionId,
      searchKey: s.searchKey,
      searchKeyword: s.searchKeyword,
      locationQuery: s.locationQuery,
      searchUrl: s.searchUrl,
      pageIndex: s.pageIndex,
      startOffset: s.startOffset,
      cardIndex: s.cardIndex,
      savedCount: s.savedCount,
      rejectedCount: s.rejectedCount,
      status: s.status,
      stopReason: s.stopReason,
      snapshot: s.snapshot ?? null,
    });

    let recordedJobs = 0;
    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      recordedJobs = await crawlSessionRepository.recordJobs(s.sessionId, body.jobs);
    }

    return NextResponse.json(
      { success: true, data: saved, recordedJobs },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi khi ghi trạng thái phiên cào", error: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
