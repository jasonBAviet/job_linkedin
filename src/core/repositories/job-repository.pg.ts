import "server-only";
import type { PoolClient } from "pg";
import { DatePostedFilter, JobPosting, JobSearchFilters } from "../dtos/job.dto";
import { query, tx } from "../db/client";
import {
  JOB_COLUMNS,
  JobRow,
  jobDedupKeys,
  jobPostingToParams,
  rowToJobPosting,
} from "./job.mapper";
import { comparePostedDate, parsePostedDate } from "../utils/posted-date";

/**
 * Kho việc làm trên PostgreSQL (đi qua SSH tunnel).
 *
 * Giữ NGUYÊN ngữ nghĩa lọc của bản in-memory cũ, kể cả các quirk:
 *  - roleCategory: luôn cho lọt HYBRID_BA_DA
 *  - seniority: giá trị đặc biệt SENIOR_AND_ABOVE
 *  - minSalaryVND: loại job không có salary_min, quy đổi USD theo tỷ giá 25400
 *  - userStatus mặc định: ẩn job HIDDEN
 */

/**
 * postedDate của LinkedIn là chuỗi TƯƠNG ĐỐI ("2 weeks ago", "3 ngày trước").
 * Không port sang SQL được nên lọc sau khi lấy về — giữ đúng logic cũ 1:1.
 */
function matchesDatePosted(postedDateStr: string | undefined, filter: DatePostedFilter | undefined): boolean {
  if (!postedDateStr || !filter || filter === "ALL") return true;
  const str = postedDateStr.toLowerCase();

  if (filter === "PAST_24H") {
    return (
      str.includes("giờ") || str.includes("hour") || str.includes("phút") ||
      str.includes("minute") || str.includes("vừa") || str.includes("just") ||
      str.includes("1 ngày") || str.includes("1 day")
    );
  }

  if (filter === "PAST_WEEK") {
    if (
      str.includes("giờ") || str.includes("hour") || str.includes("phút") ||
      str.includes("minute") || str.includes("vừa") || str.includes("just") ||
      str.includes("1 tuần") || str.includes("1 week")
    ) {
      return true;
    }
    const daysMatch = str.match(/(\d+)\s*(ngày|day)/);
    if (daysMatch) return parseInt(daysMatch[1], 10) <= 7;
    return false;
  }

  if (filter === "PAST_MONTH") {
    if (str.includes("tháng") || str.includes("month")) {
      const monthMatch = str.match(/(\d+)\s*(tháng|month)/);
      if (monthMatch) return parseInt(monthMatch[1], 10) <= 1;
      return true;
    }
    return true;
  }

  return true;
}

const SELECT_ALL = `SELECT ${JOB_COLUMNS.join(", ")}, user_status FROM jobs`;
const RETURNING_ALL = `RETURNING ${JOB_COLUMNS.join(", ")}, user_status`;

const INSERT_HEAD = `INSERT INTO jobs (${JOB_COLUMNS.join(", ")})
  VALUES (${JOB_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})`;

/**
 * Tìm dòng đã có theo 3 tầng khoá, ưu tiên tầng chắc chắn nhất.
 * FOR UPDATE để hai request cào song song không cùng chèn một job.
 */
const FIND_EXISTING = `
  ${SELECT_ALL}
  WHERE ($1::text IS NOT NULL AND linkedin_job_id = $1::text)
     OR linkedin_url = $2::text
     OR content_key  = $3::text
  ORDER BY
    (linkedin_job_id IS NOT NULL AND linkedin_job_id = $1::text) DESC,
    (linkedin_url = $2::text) DESC,
    created_at ASC
  LIMIT 1
  FOR UPDATE`;

/**
 * Bản mới có ngày đăng MỚI HƠN -> ghi đè nội dung.
 * Vẫn COALESCE các trường lẻ để không xoá dữ liệu tốt bằng NULL, và giữ nguyên
 * id / created_at / user_status (trạng thái SAVED, HIDDEN là của người dùng).
 */
const SET_OVERWRITE = `
  linkedin_job_id = COALESCE(EXCLUDED.linkedin_job_id, jobs.linkedin_job_id),
  linkedin_url    = EXCLUDED.linkedin_url,
  content_key     = EXCLUDED.content_key,
  title           = EXCLUDED.title,
  company         = EXCLUDED.company,
  company_logo    = COALESCE(EXCLUDED.company_logo, jobs.company_logo),
  location        = EXCLUDED.location,
  location_details = EXCLUDED.location_details,
  role_category   = EXCLUDED.role_category,
  seniority       = EXCLUDED.seniority,
  work_mode       = EXCLUDED.work_mode,
  salary_min      = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
  salary_max      = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
  salary_currency = COALESCE(EXCLUDED.salary_currency, jobs.salary_currency),
  salary_is_negotiable = COALESCE(EXCLUDED.salary_is_negotiable, jobs.salary_is_negotiable),
  salary_display  = COALESCE(EXCLUDED.salary_display, jobs.salary_display),
  job_description = CASE WHEN length(EXCLUDED.job_description) > length(jobs.job_description)
                         THEN EXCLUDED.job_description ELSE jobs.job_description END,
  raw_content     = COALESCE(EXCLUDED.raw_content, jobs.raw_content),
  raw_badges      = EXCLUDED.raw_badges,
  requirements_summary     = EXCLUDED.requirements_summary,
  responsibilities_summary = EXCLUDED.responsibilities_summary,
  extracted_skills = EXCLUDED.extracted_skills,
  posted_date     = COALESCE(NULLIF(EXCLUDED.posted_date, ''), jobs.posted_date),
  posted_at       = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
  crawled_at      = COALESCE(EXCLUDED.crawled_at, jobs.crawled_at),
  is_easy_apply   = COALESCE(EXCLUDED.is_easy_apply, jobs.is_easy_apply),
  apply_type      = COALESCE(EXCLUDED.apply_type, jobs.apply_type),
  experience_years_required = COALESCE(EXCLUDED.experience_years_required, jobs.experience_years_required),
  applicant_count = COALESCE(EXCLUDED.applicant_count, jobs.applicant_count),
  applicant_count_text = COALESCE(EXCLUDED.applicant_count_text, jobs.applicant_count_text),
  competition_level = COALESCE(EXCLUDED.competition_level, jobs.competition_level),
  is_promoted     = COALESCE(EXCLUDED.is_promoted, jobs.is_promoted),
  is_actively_reviewing = COALESCE(EXCLUDED.is_actively_reviewing, jobs.is_actively_reviewing),
  responses_managed_off_linkedin = COALESCE(EXCLUDED.responses_managed_off_linkedin, jobs.responses_managed_off_linkedin),
  data_source     = COALESCE(EXCLUDED.data_source, jobs.data_source),
  inferred_fields = EXCLUDED.inferred_fields,
  missing_fields  = EXCLUDED.missing_fields,
  updated_at      = now()`;

/**
 * Bản mới CÙNG ngày đăng (hoặc cũ hơn / không đọc được ngày) -> KHÔNG ghi đè.
 * Chỉ vá những ô đang trống: COALESCE đảo chiều, giá trị cũ luôn thắng.
 * Ngoại lệ duy nhất là job_description — bản dài hơn là bản đầy đủ hơn, không phải
 * dữ liệu mâu thuẫn, nên vẫn lấy (giữ đúng hành vi vốn có của repo).
 */
const SET_PATCH_MISSING = `
  linkedin_job_id = COALESCE(jobs.linkedin_job_id, EXCLUDED.linkedin_job_id),
  company_logo    = COALESCE(jobs.company_logo, EXCLUDED.company_logo),
  location_details = CASE WHEN jobs.location_details = ''
                          THEN EXCLUDED.location_details ELSE jobs.location_details END,
  salary_min      = COALESCE(jobs.salary_min, EXCLUDED.salary_min),
  salary_max      = COALESCE(jobs.salary_max, EXCLUDED.salary_max),
  salary_currency = COALESCE(jobs.salary_currency, EXCLUDED.salary_currency),
  salary_is_negotiable = COALESCE(jobs.salary_is_negotiable, EXCLUDED.salary_is_negotiable),
  salary_display  = COALESCE(jobs.salary_display, EXCLUDED.salary_display),
  job_description = CASE WHEN length(EXCLUDED.job_description) > length(jobs.job_description)
                         THEN EXCLUDED.job_description ELSE jobs.job_description END,
  raw_content     = COALESCE(jobs.raw_content, EXCLUDED.raw_content),
  raw_badges      = CASE WHEN cardinality(jobs.raw_badges) = 0
                         THEN EXCLUDED.raw_badges ELSE jobs.raw_badges END,
  requirements_summary = CASE WHEN cardinality(jobs.requirements_summary) = 0
                         THEN EXCLUDED.requirements_summary ELSE jobs.requirements_summary END,
  responsibilities_summary = CASE WHEN cardinality(jobs.responsibilities_summary) = 0
                         THEN EXCLUDED.responsibilities_summary ELSE jobs.responsibilities_summary END,
  extracted_skills = CASE WHEN jsonb_array_length(jobs.extracted_skills) = 0
                         THEN EXCLUDED.extracted_skills ELSE jobs.extracted_skills END,
  posted_date     = CASE WHEN jobs.posted_date = ''
                         THEN EXCLUDED.posted_date ELSE jobs.posted_date END,
  posted_at       = COALESCE(jobs.posted_at, EXCLUDED.posted_at),
  crawled_at      = COALESCE(jobs.crawled_at, EXCLUDED.crawled_at),
  is_easy_apply   = COALESCE(jobs.is_easy_apply, EXCLUDED.is_easy_apply),
  apply_type      = COALESCE(jobs.apply_type, EXCLUDED.apply_type),
  experience_years_required = COALESCE(jobs.experience_years_required, EXCLUDED.experience_years_required),
  applicant_count = COALESCE(jobs.applicant_count, EXCLUDED.applicant_count),
  applicant_count_text = COALESCE(jobs.applicant_count_text, EXCLUDED.applicant_count_text),
  competition_level = COALESCE(jobs.competition_level, EXCLUDED.competition_level),
  is_promoted     = COALESCE(jobs.is_promoted, EXCLUDED.is_promoted),
  is_actively_reviewing = COALESCE(jobs.is_actively_reviewing, EXCLUDED.is_actively_reviewing),
  responses_managed_off_linkedin = COALESCE(jobs.responses_managed_off_linkedin, EXCLUDED.responses_managed_off_linkedin),
  data_source     = COALESCE(jobs.data_source, EXCLUDED.data_source),
  updated_at      = now()`;

/** Kết quả của một lần nạp — extension cần phân biệt để báo cáo cho đúng. */
export type UpsertOutcome = "INSERTED" | "OVERWRITTEN" | "PATCHED";

export interface UpsertJobResult {
  job: JobPosting;
  outcome: UpsertOutcome;
  /** Lý do ngắn gọn, dùng cho log và thông báo trên extension. */
  reason: string;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "23505";
}

export class JobRepository {
  public async getAllJobs(): Promise<JobPosting[]> {
    const rows = await query<JobRow>(
      `${SELECT_ALL} ORDER BY created_at DESC`
    );
    return rows.map(rowToJobPosting);
  }

  public async getJobById(id: string): Promise<JobPosting | undefined> {
    const rows = await query<JobRow>(`${SELECT_ALL} WHERE id = $1`, [id]);
    return rows[0] ? rowToJobPosting(rows[0]) : undefined;
  }

  public async filterJobs(filters: JobSearchFilters): Promise<JobPosting[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (filters.keyword && filters.keyword.trim() !== "") {
      const kw = `%${filters.keyword.trim()}%`;
      where.push(
        `(title ILIKE ${p(kw)} OR company ILIKE ${p(kw)} OR job_description ILIKE ${p(kw)}
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(extracted_skills) s
                     WHERE s->>'name' ILIKE ${p(kw)}))`
      );
    }

    if (filters.company && filters.company.trim() !== "") {
      where.push(`company ILIKE ${p(`%${filters.company.trim()}%`)}`);
    }

    if (filters.location && filters.location !== "ALL") {
      where.push(`location = ${p(filters.location)}`);
    }

    // Quirk cố ý giữ nguyên: job HYBRID_BA_DA luôn lọt mọi bộ lọc vai trò
    if (filters.roleCategory && filters.roleCategory !== "ALL") {
      where.push(`(role_category = ${p(filters.roleCategory)} OR role_category = 'HYBRID_BA_DA')`);
    }

    if (filters.seniority && filters.seniority !== "ALL") {
      if (filters.seniority === "SENIOR_AND_ABOVE") {
        where.push(`seniority IN ('SENIOR','LEAD_MANAGER')`);
      } else {
        where.push(`seniority = ${p(filters.seniority)}`);
      }
    }

    if (filters.workMode && filters.workMode !== "ALL") {
      where.push(`work_mode = ${p(filters.workMode)}`);
    }

    if (filters.applyType && filters.applyType !== "ALL") {
      if (filters.applyType === "EASY_APPLY") {
        where.push(`(is_easy_apply IS TRUE OR apply_type = 'EASY_APPLY')`);
      } else {
        where.push(`(COALESCE(is_easy_apply, FALSE) IS FALSE AND COALESCE(apply_type,'') <> 'EASY_APPLY')`);
      }
    } else if (filters.isEasyApply) {
      where.push(`is_easy_apply IS TRUE`);
    }

    if (filters.competitionLevel && filters.competitionLevel !== "ALL") {
      where.push(`competition_level = ${p(filters.competitionLevel)}`);
    }

    if (filters.minExperienceYears !== undefined && filters.minExperienceYears > 0) {
      where.push(`COALESCE(experience_years_required, 0) >= ${p(filters.minExperienceYears)}`);
    }

    // salary_min_vnd là generated column đã quy đổi USD*25400.
    // NULL tự bị loại bởi phép so sánh -> khớp đúng hành vi cũ.
    if (filters.minSalaryVND !== undefined && filters.minSalaryVND > 0) {
      where.push(`salary_min_vnd >= ${p(filters.minSalaryVND)}`);
    }

    if (filters.hasSalary) {
      where.push(`salary_min IS NOT NULL`);
    }

    if (filters.userStatus && filters.userStatus !== "ALL") {
      where.push(`user_status = ${p(filters.userStatus)}`);
    } else {
      // Mặc định ẩn job người dùng đã HIDDEN
      where.push(`user_status <> 'HIDDEN'`);
    }

    const sql = `${SELECT_ALL}
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC`;

    const rows = await query<JobRow>(sql, params);
    let jobs = rows.map(rowToJobPosting);

    // Lọc ngày đăng ở tầng ứng dụng vì postedDate là chuỗi tương đối
    if (filters.datePosted && filters.datePosted !== "ALL") {
      jobs = jobs.filter((j) => matchesDatePosted(j.postedDate, filters.datePosted));
    }

    return jobs;
  }

  /**
   * Nạp 1 việc làm, KHỬ TRÙNG LẶP theo 3 tầng khoá rồi quyết định theo NGÀY ĐĂNG.
   *
   * Trước đây chỗ này chỉ `ON CONFLICT (id)`, trong khi bảng còn ba UNIQUE index khác
   * (linkedin_job_id, linkedin_url, content_key). Cùng một tin cào lại mà id đổi
   * (id legacy nhúng Date.now()) thì không khớp `id` -> Postgres bắn 23505 và cả lô
   * nạp hỏng. Nay tra dòng cũ trước, rồi:
   *
   *   ngày đăng MỚI HƠN  -> ghi đè (tin đăng lại, nội dung mới)
   *   CÙNG ngày đăng     -> không ghi đè, chỉ vá ô còn trống
   *   CŨ HƠN / không rõ  -> giữ bản đang lưu, cũng chỉ vá ô còn trống
   *
   * Cả cụm nằm trong một transaction + SELECT ... FOR UPDATE nên hai luồng cào
   * song song không thể cùng chèn một job.
   */
  public async upsertJob(newJob: JobPosting): Promise<UpsertJobResult> {
    const params = jobPostingToParams(newJob);
    const keys = jobDedupKeys(newJob);

    return tx(async (c) => {
      const found = await c.query<JobRow>(FIND_EXISTING, [
        keys.linkedinJobId,
        keys.url,
        keys.contentKey,
      ]);
      const existing = found.rows[0];

      if (!existing) {
        const inserted = await this.insertNew(c, params);
        if (inserted) {
          return { job: inserted, outcome: "INSERTED" as const, reason: "Bản ghi mới" };
        }
        // Luồng khác vừa chèn xong giữa hai câu lệnh -> đọc lại và xử như đã có.
        const retry = await c.query<JobRow>(FIND_EXISTING, [
          keys.linkedinJobId,
          keys.url,
          keys.contentKey,
        ]);
        if (!retry.rows[0]) {
          throw new Error("[jobs] không chèn được mà cũng không tìm thấy dòng trùng");
        }
        return this.resolveAgainstExisting(c, retry.rows[0], newJob, params);
      }

      return this.resolveAgainstExisting(c, existing, newJob, params);
    });
  }

  /** Chèn mới. Trả null khi đụng UNIQUE index (một luồng khác vừa chèn trước). */
  private async insertNew(c: PoolClient, params: unknown[]): Promise<JobPosting | null> {
    await c.query("SAVEPOINT sp_insert");
    try {
      const res = await c.query<JobRow>(
        `${INSERT_HEAD} ON CONFLICT DO NOTHING ${RETURNING_ALL}`,
        params as never[]
      );
      await c.query("RELEASE SAVEPOINT sp_insert");
      return res.rows[0] ? rowToJobPosting(res.rows[0]) : null;
    } catch (e) {
      await c.query("ROLLBACK TO SAVEPOINT sp_insert");
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  /**
   * So ngày đăng của bản mới với dòng đang lưu rồi ghi đè / vá.
   *
   * Ghi qua `INSERT ... ON CONFLICT (id) DO UPDATE` chứ không phải `UPDATE` thuần:
   * mệnh đề VALUES định kiểu cho toàn bộ tham số (UPDATE thuần thì tham số nào không
   * được nhắc tới trong SET sẽ khiến Postgres báo "could not determine data type"),
   * và EXCLUDED.* cho phép viết luật gộp gọn gàng. Ép params[0] về id của dòng ĐANG
   * CÓ để đụng đúng dòng đó, kể cả khi bản mới mang id khác.
   */
  private async resolveAgainstExisting(
    c: PoolClient,
    existing: JobRow,
    newJob: JobPosting,
    params: unknown[]
  ): Promise<UpsertJobResult> {
    const next = parsePostedDate(newJob.postedDate, newJob.crawledAt);
    const prev = parsePostedDate(existing.posted_date, existing.crawled_at);
    const cmp = comparePostedDate(next, prev);
    const args = [...params];
    args[0] = existing.id;

    const write = async (setClause: string) =>
      c.query<JobRow>(
        `${INSERT_HEAD} ON CONFLICT (id) DO UPDATE SET ${setClause} ${RETURNING_ALL}`,
        args as never[]
      );

    if (cmp === "NEWER") {
      await c.query("SAVEPOINT sp_overwrite");
      try {
        const res = await write(SET_OVERWRITE);
        await c.query("RELEASE SAVEPOINT sp_overwrite");
        return {
          job: rowToJobPosting(res.rows[0]),
          outcome: "OVERWRITTEN",
          reason: `Ngày đăng mới hơn (${prev.postedAt ?? "?"} -> ${next.postedAt ?? "?"})`,
        };
      } catch (e) {
        // Ghi đè có thể đụng UNIQUE của MỘT dòng khác (vd tin đăng lại đã tồn tại
        // riêng). Không làm hỏng cả transaction — lùi về vá ô trống cho an toàn.
        await c.query("ROLLBACK TO SAVEPOINT sp_overwrite");
        if (!isUniqueViolation(e)) throw e;
      }
    }

    const res = await write(SET_PATCH_MISSING);
    return {
      job: rowToJobPosting(res.rows[0]),
      outcome: "PATCHED",
      reason:
        cmp === "SAME"
          ? `Trùng, cùng ngày đăng (${prev.postedAt ?? "?"}) — chỉ vá ô còn trống`
          : cmp === "OLDER"
          ? `Trùng, ngày đăng cũ hơn (${next.postedAt ?? "?"} < ${prev.postedAt ?? "?"}) — giữ bản đang lưu`
          : "Trùng, không đọc được ngày đăng — giữ bản đang lưu",
    };
  }

  /** Giữ chữ ký cũ cho các nơi chỉ cần bản ghi sau khi nạp. */
  public async addJob(newJob: JobPosting): Promise<JobPosting> {
    return (await this.upsertJob(newJob)).job;
  }

  /** Nạp hàng loạt, trả về SỐ BẢN GHI THÊM MỚI (khớp ngữ nghĩa cũ). */
  public async addBulkJobs(newJobs: JobPosting[]): Promise<number> {
    let added = 0;
    for (const job of newJobs) {
      const { outcome } = await this.upsertJob(job);
      if (outcome === "INSERTED") added++;
    }
    return added;
  }

  public async removeJob(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>("DELETE FROM jobs WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }

  public async clearAllJobs(): Promise<void> {
    await query("DELETE FROM jobs");
  }
}

export const jobRepository = new JobRepository();
