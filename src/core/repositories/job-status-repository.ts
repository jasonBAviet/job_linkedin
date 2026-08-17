/**
 * Trạng thái người dùng gán cho job — hiện lưu ở cột jobs.user_status trên PostgreSQL.
 * Bản cũ lưu file JSON được giữ ở job-status-repository.json.ts.bak để đối chiếu.
 */
export type { JobStatusEntry } from "./job-status-repository.pg";
export { JobStatusRepository, jobStatusRepository } from "./job-status-repository.pg";
