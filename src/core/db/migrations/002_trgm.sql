-- Index trigram cho tìm kiếm từ khoá (title/company) bằng ILIKE.
-- Tách riêng khỏi 001 vì CREATE EXTENSION cần quyền cao; nếu fail thì 001 vẫn đứng vững
-- và ILIKE seq-scan trên vài nghìn dòng vẫn dưới 50ms.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm   ON jobs USING gin (title   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING gin (company gin_trgm_ops);
