/**
 * Tạo database (nếu chưa có) rồi chạy các file .sql trong src/core/db/migrations theo thứ tự tên.
 * Chạy: node scripts/migrate.mjs
 *
 * Không dùng auto-DDL lúc boot: Next dev chạy nhiều worker, CREATE INDEX đồng thời
 * sẽ deadlock trên catalog.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./lib/env.mjs";
import { openTunnel } from "./lib/tunnel.mjs";

const env = loadEnv();
const MIGRATIONS_DIR = path.join(env.ROOT, "src", "core", "db", "migrations");

function client(port, database) {
  return new pg.Client({
    host: "127.0.0.1",
    port,
    database,
    user: env.dbUser,
    password: env.dbPassword,
    ssl: false,
    connectionTimeoutMillis: 15000,
    application_name: "job-hunter-migrate",
  });
}

async function main() {
  const tunnel = await openTunnel(env, "migrate");
  console.log(`Tunnel: 127.0.0.1:${tunnel.localPort} -> ${env.remoteDbHost}:${env.remoteDbPort}`);

  // --- Bước 1: tạo database nếu chưa có (phải nối qua database bảo trì) ---
  const admin = client(tunnel.localPort, env.maintenanceDb);
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [env.dbName]);
  if (exists.rowCount === 0) {
    // Không tham số hoá được tên database -> phải quote định danh thủ công
    const safe = '"' + env.dbName.replace(/"/g, '""') + '"';
    await admin.query(`CREATE DATABASE ${safe}`);
    console.log(`Da tao database "${env.dbName}"`);
  } else {
    console.log(`Database "${env.dbName}" da ton tai`);
  }
  await admin.end();

  // --- Bước 2: chạy migration trong database đích ---
  const db = client(tunnel.localPort, env.dbName);
  await db.connect();
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const done = new Set((await db.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`  - bo qua ${file} (da chay)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.query("BEGIN");
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
      await db.query("COMMIT");
      console.log(`  + da chay ${file}`);
      applied++;
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      // 002_trgm cần quyền CREATE EXTENSION — thiếu thì chỉ mất tối ưu, không chặn
      if (file.includes("trgm")) {
        console.warn(`  ! bo qua ${file}: ${e.message}`);
        continue;
      }
      throw e;
    }
  }

  const t = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  console.log(`\nDa chay ${applied} migration. Bang trong "${env.dbName}":`);
  t.rows.forEach((r) => console.log("  -", r.tablename));

  await db.end();
  await tunnel.close();
}

main().catch(async (e) => {
  console.error("Migration THAT BAI:", e.message);
  process.exit(1);
});
