import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { getTunnel, closeTunnel, onTunnelLost } from "./tunnel";

/**
 * Pool Postgres đi qua SSH tunnel.
 *
 * Mặc định `pg` trả NUMERIC (OID 1700) và BIGINT (OID 20) dưới dạng string để
 * không mất độ chính xác. Toàn bộ app đang coi các trường này là number
 * (experienceYearsRequired, salaryRange.min...) nên phải đăng ký parser,
 * nếu không so sánh số sẽ sai âm thầm.
 */
types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : Number.parseInt(v, 10)));
// DATE (OID 1082): mặc định `pg` dựng Date lúc nửa đêm GIỜ ĐỊA PHƯƠNG -> lệch một ngày
// khi máy chủ khác múi giờ. posted_at chỉ cần "YYYY-MM-DD" nên giữ nguyên chuỗi.
types.setTypeParser(1082, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __jhPool: Promise<Pool> | undefined;
  // eslint-disable-next-line no-var
  var __jhPoolHook: boolean | undefined;
}

function env(key: string, fallback?: string): string {
  const v = (process.env[key] || "").trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`[db] Thiếu biến môi trường ${key} trong .env`);
}

async function createPool(): Promise<Pool> {
  const { localPort } = await getTunnel();
  const pool = new Pool({
    host: "127.0.0.1",
    port: localPort,
    // DB_NAME có thể là chuỗi rỗng (không phải undefined) -> .trim() || fallback
    database: env("DB_NAME", "job_hunter"),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    ssl: false, // SSH đã mã hoá; bật TLS nữa là thừa
    max: 5, // pool nhỏ: mọi connection đi chung một SSH transport
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 20_000,
    application_name: "job-hunter",
  });
  pool.on("error", (err) => {
    console.error("[db] pool lỗi:", err.message);
    void resetDb();
  });
  return pool;
}

export function getPool(): Promise<Pool> {
  if (!globalThis.__jhPool) {
    globalThis.__jhPool = createPool().catch((e) => {
      globalThis.__jhPool = undefined;
      throw e;
    });
  }
  if (!globalThis.__jhPoolHook) {
    globalThis.__jhPoolHook = true;
    onTunnelLost(() => void resetDb()); // tunnel chết -> pool chết theo
  }
  return globalThis.__jhPool;
}

export async function resetDb(): Promise<void> {
  const p = globalThis.__jhPool;
  globalThis.__jhPool = undefined;
  if (p) {
    try {
      (await p).end();
    } catch {}
  }
  await closeTunnel();
}

const RETRYABLE = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "57P01"]);

function isConnectionError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code && RETRYABLE.has(code)) return true;
  return /Connection terminated|timeout exceeded|Client has encountered|server closed the connection/i.test(
    String((e as Error)?.message || "")
  );
}

/** Query có tự phục hồi: tunnel đứt -> dựng lại rồi thử lại ĐÚNG một lần. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const pool = await getPool();
    return (await pool.query<T>(text, params as never[])).rows;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    console.warn("[db] mất kết nối, dựng lại tunnel và thử lại...");
    await resetDb();
    const pool = await getPool();
    return (await pool.query<T>(text, params as never[])).rows;
  }
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await getPool()).connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}
