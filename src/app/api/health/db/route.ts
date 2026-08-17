import { NextResponse } from "next/server";
import { query } from "@/core/db/client";

/**
 * Kiểm tra kết nối PostgreSQL (qua SSH tunnel) từ chính tiến trình Next.js.
 * Tách riêng khỏi /api/health để phân biệt "server sống" với "server nối được DB".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const rows = await query<{ n: number; db: string; ver: string }>(
      "SELECT (SELECT count(*) FROM jobs)::int AS n, current_database() AS db, version() AS ver"
    );
    const r = rows[0];
    return NextResponse.json({
      ok: true,
      database: r.db,
      jobCount: r.n,
      serverVersion: r.ver.split(",")[0],
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Không kết nối được PostgreSQL qua SSH tunnel",
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }
}
