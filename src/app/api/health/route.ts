import { NextResponse } from "next/server";

/**
 * Endpoint kiểm tra kết nối cho Extension.
 * Tách riêng khỏi /api/jobs/import để việc "ping" máy chủ KHÔNG ghi dữ liệu rác vào kho việc làm.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "job-hunter",
      time: new Date().toISOString(),
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
