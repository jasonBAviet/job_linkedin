import "server-only";
import { query } from "../db/client";

/**
 * Lịch sử phiên cào trên PostgreSQL.
 *
 * Đây là tầng TELEMETRY, không phải nguồn resume — nguồn resume thật là
 * chrome.storage.local phía extension. Máy chủ tắt thì cào vẫn tiếp tục được.
 */

export interface CrawlSessionInput {
  sessionId: string;
  searchKey?: string | null;
  searchKeyword?: string | null;
  locationQuery?: string | null;
  searchUrl?: string | null;
  pageIndex?: number;
  startOffset?: number;
  cardIndex?: number;
  savedCount?: number;
  rejectedCount?: number;
  status?: string;
  stopReason?: string | null;
  snapshot?: unknown;
}

export interface CrawlSessionRow {
  session_id: string;
  search_key: string | null;
  search_keyword: string | null;
  location_query: string | null;
  search_url: string | null;
  page_index: number;
  start_offset: number;
  card_index: number;
  saved_count: number;
  rejected_count: number;
  status: string;
  stop_reason: string | null;
  started_at: Date;
  finished_at: Date | null;
  updated_at: Date;
}

const TERMINAL = new Set(["FINISHED", "ABORTED"]);

export class CrawlSessionRepository {
  /**
   * Dọn các phiên treo trước khi ghi phiên mới.
   * Dùng reaper thay cho UNIQUE INDEX "chỉ một phiên RUNNING" — index đó sẽ khoá
   * cứng người dùng nếu một phiên cũ không bao giờ được đóng.
   */
  public async reapStaleSessions(olderThanMinutes = 30): Promise<number> {
    const rows = await query<{ session_id: string }>(
      `UPDATE crawl_sessions
          SET status = 'ABORTED', finished_at = now(),
              stop_reason = 'Phiên treo: quá ${olderThanMinutes} phút không cập nhật'
        WHERE status = 'RUNNING'
          AND updated_at < now() - ($1 || ' minutes')::interval
        RETURNING session_id`,
      [String(olderThanMinutes)]
    );
    return rows.length;
  }

  /** Ghi tiến trình. GREATEST để gói tin tới trễ không kéo tụt số liệu. */
  public async upsertProgress(input: CrawlSessionInput): Promise<CrawlSessionRow> {
    const isTerminal = TERMINAL.has(String(input.status));

    const rows = await query<CrawlSessionRow>(
      `INSERT INTO crawl_sessions
         (session_id, search_key, search_keyword, location_query, search_url,
          page_index, start_offset, card_index, saved_count, rejected_count,
          status, stop_reason, snapshot, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,
               CASE WHEN $14::boolean THEN now() ELSE NULL END)
       ON CONFLICT (session_id) DO UPDATE SET
         search_key     = COALESCE(EXCLUDED.search_key, crawl_sessions.search_key),
         search_keyword = COALESCE(EXCLUDED.search_keyword, crawl_sessions.search_keyword),
         location_query = COALESCE(EXCLUDED.location_query, crawl_sessions.location_query),
         search_url     = COALESCE(EXCLUDED.search_url, crawl_sessions.search_url),
         page_index     = GREATEST(crawl_sessions.page_index, EXCLUDED.page_index),
         start_offset   = GREATEST(crawl_sessions.start_offset, EXCLUDED.start_offset),
         card_index     = EXCLUDED.card_index,
         saved_count    = GREATEST(crawl_sessions.saved_count, EXCLUDED.saved_count),
         rejected_count = GREATEST(crawl_sessions.rejected_count, EXCLUDED.rejected_count),
         status         = EXCLUDED.status,
         stop_reason    = COALESCE(EXCLUDED.stop_reason, crawl_sessions.stop_reason),
         snapshot       = COALESCE(EXCLUDED.snapshot, crawl_sessions.snapshot),
         finished_at    = CASE WHEN $14::boolean THEN now() ELSE crawl_sessions.finished_at END
       -- Lô cũ gửi lại KHÔNG được hồi sinh phiên đã kết thúc
       WHERE crawl_sessions.finished_at IS NULL OR $14::boolean
       RETURNING *`,
      [
        input.sessionId,
        input.searchKey ?? null,
        input.searchKeyword ?? null,
        input.locationQuery ?? null,
        input.searchUrl ?? null,
        input.pageIndex ?? 0,
        input.startOffset ?? 0,
        input.cardIndex ?? 0,
        input.savedCount ?? 0,
        input.rejectedCount ?? 0,
        input.status ?? "RUNNING",
        input.stopReason ?? null,
        input.snapshot ? JSON.stringify(input.snapshot) : null,
        isTerminal,
      ]
    );

    if (rows[0]) return rows[0];

    // WHERE chặn -> phiên đã kết thúc, trả về bản hiện có thay vì ném lỗi
    const existing = await query<CrawlSessionRow>(
      "SELECT * FROM crawl_sessions WHERE session_id = $1",
      [input.sessionId]
    );
    return existing[0];
  }

  public async getSession(sessionId: string): Promise<CrawlSessionRow | null> {
    const rows = await query<CrawlSessionRow>(
      "SELECT * FROM crawl_sessions WHERE session_id = $1",
      [sessionId]
    );
    return rows[0] ?? null;
  }

  public async getRecentSessions(limit = 20): Promise<CrawlSessionRow[]> {
    return query<CrawlSessionRow>(
      "SELECT * FROM crawl_sessions ORDER BY updated_at DESC LIMIT $1",
      [limit]
    );
  }

  /** Phiên gần nhất còn có thể tiếp tục (để Dashboard hiển thị). */
  public async getResumableSession(): Promise<CrawlSessionRow | null> {
    const rows = await query<CrawlSessionRow>(
      `SELECT * FROM crawl_sessions
        WHERE finished_at IS NULL AND status <> 'ABORTED'
        ORDER BY updated_at DESC LIMIT 1`
    );
    return rows[0] ?? null;
  }

  /** Nhật ký từng job trong phiên — để đối chiếu "có bỏ sót job nào không". */
  public async recordJobs(
    sessionId: string,
    jobs: Array<{
      linkedinJobId: string;
      pageUrl?: string | null;
      pageNumber?: number | null;
      cardIndex?: number | null;
      outcome?: string | null;
    }>
  ): Promise<number> {
    if (!jobs.length) return 0;

    // Ánh xạ camelCase -> snake_case TRƯỚC khi đưa vào jsonb_to_recordset:
    // hàm này khớp key theo đúng chuỗi ký tự, 'linkedinJobId' không khớp 'linkedin_job_id'.
    const payload = jobs.map((j) => ({
      linkedin_job_id: j.linkedinJobId,
      page_url: j.pageUrl ?? null,
      page_number: j.pageNumber ?? null,
      card_index: j.cardIndex ?? null,
      outcome: j.outcome ?? "SAVED",
    }));

    const rows = await query<{ linkedin_job_id: string }>(
      `INSERT INTO crawl_session_jobs
         (session_id, linkedin_job_id, page_url, page_number, card_index, outcome)
       SELECT $1, x.linkedin_job_id, x.page_url, x.page_number, x.card_index, x.outcome
         FROM jsonb_to_recordset($2::jsonb)
              AS x(linkedin_job_id TEXT, page_url TEXT, page_number INT, card_index INT, outcome TEXT)
       ON CONFLICT (session_id, linkedin_job_id) DO NOTHING
       RETURNING linkedin_job_id`,
      [sessionId, JSON.stringify(payload)]
    );
    return rows.length;
  }
}

export const crawlSessionRepository = new CrawlSessionRepository();
