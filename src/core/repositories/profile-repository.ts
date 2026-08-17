/**
 * Hồ sơ ứng viên + lịch sử ứng tuyển — hiện lưu trên PostgreSQL.
 * Bản cũ lưu file JSON được giữ ở profile-repository.json.ts.bak để đối chiếu.
 */
export {
  ProfileRepository,
  profileRepository,
  INITIAL_EMPTY_PROFILE,
} from "./profile-repository.pg";
