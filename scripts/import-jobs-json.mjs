/**
 * Migrate data/jobs.json -> PostgreSQL, khử trùng lặp 3 tầng.
 * Chạy: node scripts/import-jobs-json.mjs [--keep-guest] [--dry-run]
 *
 * Idempotent: chạy nhiều lần cho cùng kết quả.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./lib/env.mjs";
import { openTunnel } from "./lib/tunnel.mjs";
import { extractLinkedInJobId, canonicalUrl, contentKey, sourceTrust } from "./lib/job-key.mjs";

const env = loadEnv();
const KEEP_GUEST = process.argv.includes("--keep-guest");
const DRY_RUN = process.argv.includes("--dry-run");
const SRC = path.join(env.ROOT, "data", "jobs.json");

const MIN_JD = 80;

function normalize(raw) {
  const jobId = extractLinkedInJobId(raw.linkedinUrl || raw.pageUrl, raw.id);
  const url = canonicalUrl(raw.linkedinUrl || raw.pageUrl, jobId);
  if (!url) return { skip: "KHONG_CO_URL" };

  const jd = String(raw.jobDescription || raw.rawContent || "").trim();
  if (jd.length < MIN_JD) return { skip: "JD_QUA_NGAN" };

  const title = String(raw.title || "").trim();
  const company = String(raw.company || "").trim();
  if (!title || !company) return { skip: "THIEU_TITLE_HOAC_COMPANY" };

  // dataSource thiếu ở bản legacy -> suy ra từ tiền tố id
  const dataSource =
    raw.dataSource ||
    (String(raw.id).startsWith("linkedin-guest-") ? "LINKEDIN_GUEST" : "LINKEDIN_DOM");

  const sr = raw.salaryRange || null;
  const rawContent = String(raw.rawContent || "");

  return {
    row: {
      id: jobId ? `li-${jobId}` : raw.id,
      linkedin_job_id: jobId,
      linkedin_url: url,
      content_key: contentKey(title, company, raw.location),
      title,
      company,
      company_logo: raw.companyLogo || null,
      location: raw.location || "HO_CHI_MINH",
      location_details: raw.locationDetails || "",
      role_category: raw.roleCategory || "BUSINESS_ANALYST",
      seniority: raw.seniority || "SENIOR",
      work_mode: raw.workMode || "HYBRID",
      salary_min: sr && sr.min != null ? Math.round(sr.min) : null,
      salary_max: sr && sr.max != null ? Math.round(sr.max) : null,
      salary_currency: sr ? sr.currency || null : null,
      salary_is_negotiable: sr ? sr.isNegotiable ?? null : null,
      salary_display: sr ? sr.display || null : null,
      job_description: jd,
      // rawContent trùng khít jobDescription ở 100% bản ghi -> chỉ lưu khi thực sự khác
      raw_content: rawContent && rawContent !== jd ? rawContent : null,
      raw_badges: raw.rawBadges || [],
      requirements_summary: raw.requirementsSummary || [],
      responsibilities_summary: raw.responsibilitiesSummary || [],
      extracted_skills: JSON.stringify(raw.extractedSkills || []),
      posted_date: raw.postedDate || "",
      crawled_at: raw.crawledAt || null,
      is_hot: raw.isHot ?? false,
      is_easy_apply: raw.isEasyApply ?? null,
      apply_type: raw.applyType || null,
      experience_years_required: raw.experienceYearsRequired ?? null,
      applicant_count: raw.applicantCount ?? null,
      applicant_count_text: raw.applicantCountText || null,
      competition_level: raw.competitionLevel || null,
      is_promoted: raw.isPromoted ?? null,
      is_actively_reviewing: raw.isActivelyReviewing ?? null,
      responses_managed_off_linkedin: raw.responsesManagedOffLinkedIn ?? null,
      data_source: dataSource,
      inferred_fields: raw.inferredFields || [],
      missing_fields: raw.missingFields || [],
    },
    trust: sourceTrust(dataSource),
  };
}

/** Gộp 2 bản trùng: giữ bản đáng tin hơn; nếu ngang nhau thì giữ bản có JD dài hơn. */
function pickBetter(a, b) {
  if (a.trust !== b.trust) return a.trust > b.trust ? a : b;
  return a.row.job_description.length >= b.row.job_description.length ? a : b;
}

const COLUMNS = [
  "id","linkedin_job_id","linkedin_url","content_key","title","company","company_logo",
  "location","location_details","role_category","seniority","work_mode",
  "salary_min","salary_max","salary_currency","salary_is_negotiable","salary_display",
  "job_description","raw_content","raw_badges","requirements_summary","responsibilities_summary",
  "extracted_skills","posted_date","crawled_at","is_hot","is_easy_apply","apply_type",
  "experience_years_required","applicant_count","applicant_count_text","competition_level",
  "is_promoted","is_actively_reviewing","responses_managed_off_linkedin",
  "data_source","inferred_fields","missing_fields",
];

// COALESCE để KHÔNG ghi đè dữ liệu tốt bằng NULL; JD chỉ thay khi bản mới DÀI HƠN.
const UPSERT = `
INSERT INTO jobs (${COLUMNS.join(", ")})
VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})
ON CONFLICT (id) DO UPDATE SET
  linkedin_job_id  = COALESCE(EXCLUDED.linkedin_job_id, jobs.linkedin_job_id),
  company_logo     = COALESCE(EXCLUDED.company_logo, jobs.company_logo),
  salary_min       = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
  salary_max       = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
  salary_currency  = COALESCE(EXCLUDED.salary_currency, jobs.salary_currency),
  salary_display   = COALESCE(EXCLUDED.salary_display, jobs.salary_display),
  job_description  = CASE WHEN length(EXCLUDED.job_description) > length(jobs.job_description)
                          THEN EXCLUDED.job_description ELSE jobs.job_description END,
  raw_content      = COALESCE(EXCLUDED.raw_content, jobs.raw_content),
  applicant_count  = COALESCE(EXCLUDED.applicant_count, jobs.applicant_count),
  competition_level= COALESCE(EXCLUDED.competition_level, jobs.competition_level),
  is_easy_apply    = COALESCE(EXCLUDED.is_easy_apply, jobs.is_easy_apply),
  apply_type       = COALESCE(EXCLUDED.apply_type, jobs.apply_type),
  data_source      = EXCLUDED.data_source,
  updated_at       = now()
RETURNING (xmax = 0) AS inserted`;

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Khong tim thay ${SRC}`);
  const jobs = JSON.parse(fs.readFileSync(SRC, "utf8"));
  console.log(`Doc ${jobs.length} ban ghi tu data/jobs.json\n`);

  const skipped = {};
  const byKey = new Map(); // khoá dedupe -> bản tốt nhất
  let guestDropped = 0;

  for (const raw of jobs) {
    if (!KEEP_GUEST && String(raw.id).startsWith("linkedin-guest-")) {
      guestDropped++;
      continue;
    }
    const n = normalize(raw);
    if (n.skip) {
      skipped[n.skip] = (skipped[n.skip] || 0) + 1;
      continue;
    }
    // Khoá dedupe: ưu tiên id LinkedIn thật, không có thì rơi về khoá nội dung
    const key = n.row.linkedin_job_id ? `li:${n.row.linkedin_job_id}` : `ck:${n.row.content_key}`;
    byKey.set(key, byKey.has(key) ? pickBetter(byKey.get(key), n) : n);
  }

  // Khoá nội dung là UNIQUE trong DB -> phải khử lần 2 cho các bản có id khác nhau
  // nhưng cùng title+company+location
  const byContent = new Map();
  for (const n of byKey.values()) {
    const ck = n.row.content_key;
    byContent.set(ck, byContent.has(ck) ? pickBetter(byContent.get(ck), n) : n);
  }

  console.log("Ket qua khu trung:");
  console.log(`  bo qua linkedin-guest-*      : ${guestDropped}${KEEP_GUEST ? " (dang giu)" : ""}`);
  Object.entries(skipped).forEach(([k, v]) => console.log(`  bo qua ${k.padEnd(24)}: ${v}`));
  console.log(`  sau khu trung tang 1+2       : ${byKey.size}`);
  console.log(`  sau khu trung tang 3 (noi dung): ${byContent.size}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: khong ghi vao database.");
    return;
  }

  const tunnel = await openTunnel(env, "import");
  const db = new pg.Client({
    host: "127.0.0.1", port: tunnel.localPort, database: env.dbName,
    user: env.dbUser, password: env.dbPassword, ssl: false,
    connectionTimeoutMillis: 15000, application_name: "job-hunter-import",
  });
  await db.connect();

  let inserted = 0, updated = 0, failed = 0;
  for (const n of byContent.values()) {
    const values = COLUMNS.map((c) => n.row[c]);
    try {
      const r = await db.query(UPSERT, values);
      if (r.rows[0].inserted) inserted++; else updated++;
    } catch (e) {
      failed++;
      console.error(`  LOI ${n.row.id} (${n.row.title.slice(0, 40)}): ${e.message}`);
    }
  }

  const total = await db.query("SELECT count(*)::int AS n FROM jobs");
  console.log(`\nGhi vao database: them moi ${inserted}, cap nhat ${updated}, loi ${failed}`);
  console.log(`Tong so job trong bang jobs: ${total.rows[0].n}`);

  await db.end();
  await tunnel.close();
}

main().catch((e) => {
  console.error("Import THAT BAI:", e.message);
  process.exit(1);
});
