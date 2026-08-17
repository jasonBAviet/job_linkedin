/**
 * Kho việc làm — hiện lưu trên PostgreSQL (qua SSH tunnel).
 * Bản cũ lưu file JSON được giữ ở job-repository.json.ts.bak để đối chiếu.
 */
export { JobRepository, jobRepository } from "./job-repository.pg";
