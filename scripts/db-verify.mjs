/**
 * Kiểm chứng dữ liệu sau migrate. Chỉ ĐỌC.
 * Chạy: node scripts/db-verify.mjs
 */
import pg from "pg";
import { loadEnv } from "./lib/env.mjs";
import { openTunnel } from "./lib/tunnel.mjs";

const env = loadEnv();

const CHECKS = [
  ["Tong so job", "SELECT count(*)::int AS v FROM jobs"],
  ["Co linkedin_job_id", "SELECT count(*)::int AS v FROM jobs WHERE linkedin_job_id IS NOT NULL"],
  ["TRUNG linkedin_job_id (phai = 0)",
   "SELECT count(*)::int AS v FROM (SELECT linkedin_job_id FROM jobs WHERE linkedin_job_id IS NOT NULL GROUP BY 1 HAVING count(*)>1) x"],
  ["TRUNG content_key (phai = 0)",
   "SELECT count(*)::int AS v FROM (SELECT content_key FROM jobs GROUP BY 1 HAVING count(*)>1) x"],
  ["TRUNG title+company (phai = 0)",
   "SELECT count(*)::int AS v FROM (SELECT lower(title), lower(company) FROM jobs GROUP BY 1,2 HAVING count(*)>1) x"],
  ["Co luong cong bo (salary_min)", "SELECT count(*)::int AS v FROM jobs WHERE salary_min IS NOT NULL"],
  ["raw_content trung JD -> NULL (tiet kiem)", "SELECT count(*)::int AS v FROM jobs WHERE raw_content IS NULL"],
  ["JD ngan hon 80 ky tu (phai = 0)", "SELECT count(*)::int AS v FROM jobs WHERE length(job_description) < 80"],
  ["Ho so ung vien", "SELECT count(*)::int AS v FROM candidate_profile"],
  ["Phien cao", "SELECT count(*)::int AS v FROM crawl_sessions"],
];

async function main() {
  const tunnel = await openTunnel(env, "verify");
  const db = new pg.Client({
    host: "127.0.0.1", port: tunnel.localPort, database: env.dbName,
    user: env.dbUser, password: env.dbPassword, ssl: false,
    connectionTimeoutMillis: 15000, application_name: "job-hunter-verify",
  });
  await db.connect();

  console.log(`=== KIEM CHUNG DATABASE "${env.dbName}" ===\n`);
  for (const [label, sql] of CHECKS) {
    const r = await db.query(sql);
    const v = r.rows[0].v;
    const isMustBeZero = label.includes("= 0");
    const mark = isMustBeZero ? (v === 0 ? "[OK] " : "[LOI]") : "     ";
    console.log(`${mark} ${label.padEnd(42)} ${v}`);
  }

  console.log("\n--- Phan bo nguon du lieu ---");
  const src = await db.query(
    "SELECT COALESCE(data_source,'(trong)') AS s, count(*)::int AS n FROM jobs GROUP BY 1 ORDER BY n DESC"
  );
  src.rows.forEach((r) => console.log(`     ${r.s.padEnd(20)} ${r.n}`));

  console.log("\n--- Phan bo dia diem / vai tro ---");
  const fac = await db.query(
    "SELECT location, role_category, count(*)::int AS n FROM jobs GROUP BY 1,2 ORDER BY n DESC LIMIT 8"
  );
  fac.rows.forEach((r) => console.log(`     ${r.location.padEnd(14)} ${r.role_category.padEnd(18)} ${r.n}`));

  console.log("\n--- 5 job moi nhat ---");
  const recent = await db.query(
    "SELECT id, left(title,42) AS title, left(company,26) AS company FROM jobs ORDER BY created_at DESC LIMIT 5"
  );
  recent.rows.forEach((r) => console.log(`     ${r.id.padEnd(16)} ${r.title.padEnd(44)} ${r.company}`));

  await db.end();
  await tunnel.close();
}

main().catch((e) => {
  console.error("Loi:", e.message);
  process.exit(1);
});
