/**
 * Seed hồ sơ ứng viên vào candidate_profile, đồng thời dọn các bản ghi test.
 * Chạy: node scripts/seed-profile.mjs
 *
 * Giữ nguyên INITIAL_EMPTY_PROFILE trong profile-repository.ts (nguồn sự thật của app).
 */
import pg from "pg";
import { loadEnv } from "./lib/env.mjs";
import { openTunnel } from "./lib/tunnel.mjs";

const env = loadEnv();

// Sao chép từ src/core/repositories/profile-repository.ts (INITIAL_EMPTY_PROFILE)
const PROFILE = {
  id: "candidate-primary",
  fullName: "Dương Bá Diệu",
  targetRole: "HYBRID_BA_DA",
  currentSeniority: "SENIOR",
  preferredLocations: ["HO_CHI_MINH", "DONG_NAI"],
  expectedSalaryVND: 40000000,
  yearsOfTotalExperience: 4,
  education: "Cử nhân Quản trị Kinh doanh (BBA) - Đại học Kinh tế Đà Nẵng",
  certifications: [
    "Digital Transformation - Business Analysis & Information Systems (Coursera)",
    "Product Analytics Micro-Certification (PAC), Level 2",
    "Power BI for Data Analytics; Omnichannel Retail (RMIT University)",
    "Salesforce Operations",
    "ICPM Certified Supervisor",
  ],
  skills: [
    { name: "Requirements Engineering", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Process Modeling (BPMN/UML)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "User Story & Acceptance Criteria", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Data Mapping & ERD", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "SQL (Advanced Querying)", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Power BI & DAX", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Customer Data Platform (CDP) & Customer 360", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 3 },
    { name: "Data Quality & MDM", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Python for Data Analytics", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Data Modeling & Data Warehousing", category: "CORE", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "API Analysis & Postman", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "CRM & Omnichannel Messaging", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Power Automate & Workflow Integration", category: "TOOL", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Healthcare & Clinic Operations", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 2 },
    { name: "E-Commerce & Retail", category: "DOMAIN", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Supply Chain & Logistics", category: "DOMAIN", proficiencyLevel: 4, yearsOfExperience: 3 },
    { name: "Jira & Confluence", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Stakeholder Management", category: "SOFT_SKILL", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "UAT & Solution Evaluation", category: "CORE", proficiencyLevel: 5, yearsOfExperience: 4 },
    { name: "Advanced Excel", category: "TOOL", proficiencyLevel: 5, yearsOfExperience: 4 },
  ],
  rawResumeText: "",
};

// Bản ghi tổng hợp dùng để thử API lúc phát triển — không phải job LinkedIn thật
const TEST_JOB_IDS = ["li-4123456789", "li-4987654321"];

async function main() {
  const tunnel = await openTunnel(env, "seed");
  const db = new pg.Client({
    host: "127.0.0.1", port: tunnel.localPort, database: env.dbName,
    user: env.dbUser, password: env.dbPassword, ssl: false,
    connectionTimeoutMillis: 15000, application_name: "job-hunter-seed",
  });
  await db.connect();

  const r = await db.query(
    `INSERT INTO candidate_profile
       (id, full_name, target_role, current_seniority, preferred_locations,
        expected_salary_vnd, years_of_total_experience, skills, raw_resume_text,
        education, certifications, last_updated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11, now())
     ON CONFLICT (id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       target_role = EXCLUDED.target_role,
       current_seniority = EXCLUDED.current_seniority,
       preferred_locations = EXCLUDED.preferred_locations,
       expected_salary_vnd = EXCLUDED.expected_salary_vnd,
       years_of_total_experience = EXCLUDED.years_of_total_experience,
       skills = EXCLUDED.skills,
       education = EXCLUDED.education,
       certifications = EXCLUDED.certifications,
       raw_resume_text = COALESCE(NULLIF(candidate_profile.raw_resume_text,''), EXCLUDED.raw_resume_text),
       last_updated = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      PROFILE.id, PROFILE.fullName, PROFILE.targetRole, PROFILE.currentSeniority,
      PROFILE.preferredLocations, PROFILE.expectedSalaryVND, PROFILE.yearsOfTotalExperience,
      JSON.stringify(PROFILE.skills), PROFILE.rawResumeText, PROFILE.education, PROFILE.certifications,
    ]
  );
  console.log(r.rows[0].inserted ? "Da tao ho so ung vien" : "Ho so ung vien da co, da cap nhat");

  const del = await db.query("DELETE FROM jobs WHERE id = ANY($1)", [TEST_JOB_IDS]);
  console.log(`Da xoa ${del.rowCount} ban ghi test tong hop`);

  const total = await db.query("SELECT count(*)::int AS n FROM jobs");
  console.log(`Tong so job that: ${total.rows[0].n}`);

  await db.end();
  await tunnel.close();
}

main().catch((e) => {
  console.error("Loi:", e.message);
  process.exit(1);
});
