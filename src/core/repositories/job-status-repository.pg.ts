import "server-only";
import { JobUserStatus } from "../dtos/job.dto";
import { query } from "../db/client";

/**
 * Trạng thái người dùng gán cho từng job (SAVED / VIEWED / HIDDEN).
 * Lưu thẳng vào cột jobs.user_status thay vì file riêng — nhờ đó lọc theo
 * trạng thái làm được ngay trong SQL, không phải lọc lại ở tầng ứng dụng.
 */

export interface JobStatusEntry {
  status: JobUserStatus;
  updatedAt: string;
}

type StatusMap = Record<string, JobStatusEntry>;

export class JobStatusRepository {
  public async getStatus(jobId: string): Promise<JobUserStatus> {
    const rows = await query<{ user_status: string }>(
      "SELECT user_status FROM jobs WHERE id = $1",
      [jobId]
    );
    return (rows[0]?.user_status as JobUserStatus) || "NEW";
  }

  public async setStatus(jobId: string, status: JobUserStatus): Promise<void> {
    await query("UPDATE jobs SET user_status = $2 WHERE id = $1", [jobId, status]);
  }

  public async getAll(): Promise<StatusMap> {
    const rows = await query<{ id: string; user_status: string; updated_at: Date }>(
      "SELECT id, user_status, updated_at FROM jobs WHERE user_status <> 'NEW'"
    );
    const map: StatusMap = {};
    for (const r of rows) {
      map[r.id] = {
        status: r.user_status as JobUserStatus,
        updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
      };
    }
    return map;
  }

  public async getByStatus(status: JobUserStatus): Promise<string[]> {
    if (status === "NEW") return [];
    const rows = await query<{ id: string }>(
      "SELECT id FROM jobs WHERE user_status = $1",
      [status]
    );
    return rows.map((r) => r.id);
  }

  public async getCounts(): Promise<Record<JobUserStatus, number>> {
    const rows = await query<{ user_status: string; n: number }>(
      "SELECT user_status, count(*)::int AS n FROM jobs GROUP BY user_status"
    );
    const counts: Record<JobUserStatus, number> = { NEW: 0, SAVED: 0, VIEWED: 0, HIDDEN: 0 };
    for (const r of rows) {
      counts[r.user_status as JobUserStatus] = r.n;
    }
    return counts;
  }
}

export const jobStatusRepository = new JobStatusRepository();
