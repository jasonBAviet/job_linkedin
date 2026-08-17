-- posted_at — ngày đăng TUYỆT ĐỐI, quy từ posted_date (chuỗi tương đối) neo vào crawled_at.
--
-- posted_date vẫn giữ nguyên chuỗi gốc của LinkedIn (để hiển thị và để biết độ mịn:
-- "2 weeks ago" chỉ chính xác tới tuần). posted_at là bản quy đổi để MÁY so sánh —
-- không có nó thì không trả lời được "bản mới có ngày đăng mới hơn bản cũ không".

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_at DATE;

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);

-- Backfill một lần cho dữ liệu đã có.
-- Logic phải khớp parsePostedDate() trong src/core/utils/posted-date.ts.
-- Tắt trigger updated_at: đây là vá dữ liệu kỹ thuật, không phải người dùng sửa job.
ALTER TABLE jobs DISABLE TRIGGER trg_jobs_updated_at;

UPDATE jobs j
SET posted_at = x.d
FROM (
  SELECT
    id,
    CASE
      -- Bản ghi legacy đã ở dạng ISO -> dùng thẳng
      WHEN posted_date ~ '^\d{4}-\d{2}-\d{2}'
        THEN substring(posted_date from '^\d{4}-\d{2}-\d{2}')::date

      -- Vừa đăng / trong vòng vài giờ -> coi như đăng đúng ngày cào
      WHEN posted_date ~* '(just now|vừa xong|vừa đăng|minute|phút|hour|giờ)'
        THEN COALESCE(crawled_at, now())::date

      WHEN posted_date ~* '(yesterday|hôm qua)'
        THEN COALESCE(crawled_at, now())::date - 1

      -- "N ngày/tuần/tháng/năm trước", có thể kèm tiền tố "Reposted"
      WHEN posted_date ~ '\d'
        THEN COALESCE(crawled_at, now())::date - (
          (regexp_match(posted_date, '(\d+)'))[1]::int *
          CASE
            WHEN posted_date ~* '(week|tuần)'   THEN 7
            WHEN posted_date ~* '(month|tháng)' THEN 30
            WHEN posted_date ~* '(year|năm)'    THEN 365
            ELSE 1
          END
        )

      ELSE NULL
    END AS d
  FROM jobs
  WHERE posted_date <> ''
) x
WHERE j.id = x.id AND j.posted_at IS NULL;

ALTER TABLE jobs ENABLE TRIGGER trg_jobs_updated_at;
