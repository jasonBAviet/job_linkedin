-- Job Hunter — schema khởi tạo
-- Yêu cầu PostgreSQL >= 12 (dùng GENERATED ALWAYS AS ... STORED). Server hiện tại: 15.15

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id                    TEXT PRIMARY KEY,

  -- Khoá khử trùng lặp
  linkedin_job_id       TEXT,          -- tầng 1: id số thật của LinkedIn
  linkedin_url          TEXT NOT NULL, -- tầng 2: URL đã chuẩn hoá
  content_key           TEXT NOT NULL, -- tầng 3: hash(slug(title)+slug(company)+location)

  title                 TEXT NOT NULL,
  company               TEXT NOT NULL,
  company_logo          TEXT,

  location              TEXT NOT NULL
                          CHECK (location IN ('HO_CHI_MINH','DONG_NAI','REMOTE','HYBRID')),
  location_details      TEXT NOT NULL DEFAULT '',
  role_category         TEXT NOT NULL
                          CHECK (role_category IN ('BUSINESS_ANALYST','DATA_ANALYST','HYBRID_BA_DA')),
  seniority             TEXT NOT NULL
                          CHECK (seniority IN ('INTERN','FRESHER','JUNIOR','MIDDLE','SENIOR','LEAD_MANAGER')),
  work_mode             TEXT NOT NULL
                          CHECK (work_mode IN ('ON_SITE','HYBRID','REMOTE')),

  -- Lương: tách cột để lọc được. Đa số job LinkedIn KHÔNG công bố -> để NULL, không bịa.
  salary_min            BIGINT,
  salary_max            BIGINT,
  salary_currency       TEXT CHECK (salary_currency IN ('VND','USD')),
  salary_is_negotiable  BOOLEAN,
  salary_display        TEXT,
  -- Quy đổi sẵn để lọc "lương >= X" bằng một phép so sánh có index.
  -- Giữ đúng tỷ giá 25400 mà filterJobs đang dùng, để không đổi ngữ nghĩa lọc.
  salary_min_vnd        BIGINT GENERATED ALWAYS AS (
                          CASE WHEN salary_currency = 'USD' THEN salary_min * 25400
                               ELSE salary_min END
                        ) STORED,

  job_description       TEXT NOT NULL DEFAULT '',
  -- rawContent trùng khít jobDescription ở 100% bản ghi hiện có.
  -- Chỉ ghi khi THỰC SỰ khác, còn lại để NULL -> tiết kiệm ~1/2 dung lượng.
  raw_content           TEXT,
  raw_badges            TEXT[] NOT NULL DEFAULT '{}',

  requirements_summary      TEXT[] NOT NULL DEFAULT '{}',
  responsibilities_summary  TEXT[] NOT NULL DEFAULT '{}',
  extracted_skills          JSONB  NOT NULL DEFAULT '[]'::jsonb,

  -- postedDate của LinkedIn phần lớn là chuỗi tương đối ("2 weeks ago") -> TEXT, không phải DATE
  posted_date           TEXT NOT NULL DEFAULT '',
  crawled_at            TIMESTAMPTZ,

  is_hot                BOOLEAN NOT NULL DEFAULT FALSE,
  is_easy_apply         BOOLEAN,
  apply_type            TEXT CHECK (apply_type IN ('EASY_APPLY','EXTERNAL_APPLY')),

  -- Có giá trị thập phân (2.5) -> NUMERIC, không phải INTEGER
  experience_years_required NUMERIC(4,1),

  applicant_count       INTEGER,
  applicant_count_text  TEXT,
  competition_level     TEXT CHECK (competition_level IN ('LOW','MEDIUM','HIGH','UNKNOWN')),
  is_promoted           BOOLEAN,
  is_actively_reviewing BOOLEAN,
  responses_managed_off_linkedin BOOLEAN,

  user_status           TEXT NOT NULL DEFAULT 'NEW'
                          CHECK (user_status IN ('NEW','SAVED','VIEWED','HIDDEN')),

  -- Truy vết nguồn: không bao giờ trình bày dữ liệu suy luận như dữ liệu LinkedIn công bố
  data_source           TEXT CHECK (data_source IN
                          ('LINKEDIN_VOYAGER','LINKEDIN_JSONLD','LINKEDIN_DOM','LINKEDIN_GUEST','MANUAL_JD')),
  inferred_fields       TEXT[] NOT NULL DEFAULT '{}',
  missing_fields        TEXT[] NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe tầng 1: partial vì bản ghi legacy không có linkedin_job_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_linkedin_job_id
  ON jobs (linkedin_job_id) WHERE linkedin_job_id IS NOT NULL;
-- Dedupe tầng 2
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_linkedin_url ON jobs (linkedin_url);
-- Dedupe tầng 3 — khoá duy nhất bắt được các bản trùng mà tầng 1/2 bỏ lọt
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_content_key ON jobs (content_key);

CREATE INDEX IF NOT EXISTS idx_jobs_facets     ON jobs (location, role_category, seniority);
CREATE INDEX IF NOT EXISTS idx_jobs_created    ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_vnd ON jobs (salary_min_vnd) WHERE salary_min_vnd IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_exp        ON jobs (experience_years_required);
CREATE INDEX IF NOT EXISTS idx_jobs_source     ON jobs (data_source);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs (user_status);
CREATE INDEX IF NOT EXISTS idx_jobs_skills_gin ON jobs USING gin (extracted_skills jsonb_path_ops);

-- ============================================================
-- candidate_profile — một ứng viên duy nhất
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_profile (
  id                        TEXT PRIMARY KEY,
  full_name                 TEXT NOT NULL,
  target_role               TEXT NOT NULL,
  current_seniority         TEXT NOT NULL,
  preferred_locations       TEXT[] NOT NULL DEFAULT '{}',
  expected_salary_vnd       BIGINT,
  years_of_total_experience NUMERIC(4,1) NOT NULL DEFAULT 0,
  skills                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_resume_text           TEXT,
  education                 TEXT,
  certifications            TEXT[] NOT NULL DEFAULT '{}',
  last_updated              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- applications
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id                   TEXT PRIMARY KEY,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applied_date         TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL
                         CHECK (status IN ('SAVED','APPLIED','SCREENING','INTERVIEW','OFFER','REJECTED')),
  match_score_at_apply INTEGER NOT NULL DEFAULT 0,
  notes                TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- saveOrUpdateApplication dedupe theo jobId -> ép ràng buộc ở tầng DB
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_job ON applications (job_id);

-- ============================================================
-- crawl_sessions — checkpoint tầng máy chủ (lịch sử, telemetry)
-- Nguồn resume thật vẫn là chrome.storage phía extension.
-- ============================================================
CREATE TABLE IF NOT EXISTS crawl_sessions (
  session_id     TEXT PRIMARY KEY,
  search_key     TEXT,
  search_keyword TEXT,
  location_query TEXT,
  search_url     TEXT,
  page_index     INTEGER NOT NULL DEFAULT 0,
  start_offset   INTEGER NOT NULL DEFAULT 0,
  card_index     INTEGER NOT NULL DEFAULT 0,
  saved_count    INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'RUNNING',
  stop_reason    TEXT,
  snapshot       JSONB,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crawl_sessions_status ON crawl_sessions (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS crawl_session_jobs (
  session_id      TEXT NOT NULL REFERENCES crawl_sessions(session_id) ON DELETE CASCADE,
  linkedin_job_id TEXT NOT NULL,
  page_url        TEXT,
  page_number     INTEGER,
  card_index      INTEGER,
  outcome         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, linkedin_job_id)
);

-- ============================================================
-- updated_at tự động
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_apps_updated_at ON applications;
CREATE TRIGGER trg_apps_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_crawl_updated_at ON crawl_sessions;
CREATE TRIGGER trg_crawl_updated_at BEFORE UPDATE ON crawl_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
