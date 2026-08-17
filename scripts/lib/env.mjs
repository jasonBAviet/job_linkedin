import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Tự parse .env — dự án không cài dotenv nên không import được.
 * Biến đã có sẵn trong process.env được ưu tiên (cho phép override khi chạy lệnh).
 */
export function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) {
    throw new Error(`Không tìm thấy ${file}`);
  }

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }

  const req = (k) => {
    const v = (process.env[k] || "").trim();
    if (!v) throw new Error(`Thiếu biến bắt buộc trong .env: ${k}`);
    return v;
  };

  return {
    sshHost: req("SSH_HOST"),
    sshPort: Number((process.env.SSH_PORT || "22").trim()),
    sshUser: req("SSH_USER"),
    sshPassword: req("SSH_PASSWORD"),

    // Qua SSH tunnel, đây là địa chỉ NHÌN TỪ PHÍA SERVER — gần như luôn là 127.0.0.1.
    // Tuyệt đối KHÔNG dùng DB_HOST (đang là IP public, tunnel ra đó sẽ bị firewall chặn).
    remoteDbHost: (process.env.DB_TUNNEL_REMOTE_HOST || "127.0.0.1").trim(),
    remoteDbPort: Number((process.env.DB_PORT || "5432").trim()),

    // DB_NAME đang là CHUỖI RỖNG (không phải undefined) -> phải .trim() || fallback.
    // Dùng ?? sẽ trả về chuỗi rỗng vì "" không phải nullish.
    dbName: (process.env.DB_NAME || "").trim() || "job_hunter",
    dbUser: req("DB_USER"),
    dbPassword: req("DB_PASSWORD"),
    maintenanceDb: (process.env.DB_MAINTENANCE_NAME || "postgres").trim(),

    ROOT,
  };
}
