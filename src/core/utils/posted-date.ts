/**
 * Quy đổi ngày đăng của LinkedIn về NGÀY TUYỆT ĐỐI để so sánh được lúc khử trùng lặp.
 *
 * LinkedIn trả chuỗi TƯƠNG ĐỐI ("2 weeks ago", "Reposted 4 days ago", "3 ngày trước"),
 * xen lẫn vài bản ghi legacy dạng ISO ("2026-08-16") và chuỗi rỗng. Không quy về một
 * mốc chung thì không trả lời được câu "bản mới có ngày đăng mới hơn bản cũ không".
 *
 * Mốc neo là crawledAt (thời điểm ta nhìn thấy tin), không phải now(): tính lại một
 * bản ghi cũ ở thời điểm khác vẫn phải ra cùng kết quả.
 *
 * Logic ở đây phải khớp phần backfill trong src/core/db/migrations/003_posted_at.sql.
 */

/** Độ mịn của chuỗi ngày đăng — quyết định sai số cho phép khi so sánh. */
export type PostedGranularity = "EXACT" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" | "UNKNOWN";

export interface ParsedPostedDate {
  /** Ngày đăng tuyệt đối dạng "YYYY-MM-DD", null khi không đọc được. */
  postedAt: string | null;
  granularity: PostedGranularity;
}

/**
 * Sai số cho phép (ngày) theo độ mịn.
 *
 * LinkedIn làm tròn rất thô: một tin đăng 9 ngày trước hiển thị "1 week ago" suốt cả
 * tuần. Cào lại tin đó 3 hôm sau vẫn ra "1 week ago" nhưng neo vào crawledAt mới nên
 * postedAt trôi thêm 3 ngày. Không có dung sai thì mọi lần cào lại đều bị coi là
 * "mới hơn" và ghi đè — đúng thứ cần tránh.
 */
const TOLERANCE_DAYS: Record<PostedGranularity, number> = {
  EXACT: 0,
  HOUR: 0,
  DAY: 1,
  WEEK: 7,
  MONTH: 31,
  YEAR: 366,
  UNKNOWN: 0,
};

const MS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" theo UTC — tránh lệch ngày khi máy chủ ở múi giờ khác. */
function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Mốc neo: crawledAt nếu hợp lệ, ngược lại là bây giờ. */
function anchorMs(crawledAt?: string | Date | null): number {
  if (crawledAt) {
    const t = crawledAt instanceof Date ? crawledAt.getTime() : Date.parse(crawledAt);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

/**
 * Đọc chuỗi ngày đăng thành ngày tuyệt đối + độ mịn.
 * Không đọc được -> { postedAt: null, granularity: "UNKNOWN" } chứ không đoán bừa.
 */
export function parsePostedDate(
  postedDate?: string | null,
  crawledAt?: string | Date | null
): ParsedPostedDate {
  const raw = String(postedDate || "").trim();
  if (!raw) return { postedAt: null, granularity: "UNKNOWN" };

  // Dạng ISO của các luồng nạp cũ: đã là ngày tuyệt đối, dùng thẳng.
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return { postedAt: iso[1], granularity: "EXACT" };

  const anchor = anchorMs(crawledAt);
  // Bỏ tiền tố "Reposted" — tin đăng lại vẫn là mốc thời gian tính từ lần đăng lại.
  const s = raw.toLowerCase().replace(/^reposted\s+/, "");

  // Vừa đăng / trong vòng vài giờ -> coi như đăng đúng ngày cào.
  if (/(just now|vừa xong|vừa đăng|moments? ago)/.test(s)) {
    return { postedAt: toIsoDate(anchor), granularity: "HOUR" };
  }
  if (/(yesterday|hôm qua)/.test(s)) {
    return { postedAt: toIsoDate(anchor - MS_PER_DAY), granularity: "DAY" };
  }

  const num = s.match(/(\d+)/);
  if (!num) return { postedAt: null, granularity: "UNKNOWN" };
  const n = Number.parseInt(num[1], 10);
  if (!Number.isFinite(n)) return { postedAt: null, granularity: "UNKNOWN" };

  // Thứ tự kiểm tra đi từ đơn vị nhỏ lên lớn; "tháng" phải xét trước "năm"
  // vì cả hai đều có thể xuất hiện trong cùng một chuỗi dài.
  if (/(minute|phút|hour|giờ)/.test(s)) {
    return { postedAt: toIsoDate(anchor), granularity: "HOUR" };
  }
  if (/(day|ngày)/.test(s)) {
    return { postedAt: toIsoDate(anchor - n * MS_PER_DAY), granularity: "DAY" };
  }
  if (/(week|tuần)/.test(s)) {
    return { postedAt: toIsoDate(anchor - n * 7 * MS_PER_DAY), granularity: "WEEK" };
  }
  if (/(month|tháng)/.test(s)) {
    return { postedAt: toIsoDate(anchor - n * 30 * MS_PER_DAY), granularity: "MONTH" };
  }
  if (/(year|năm)/.test(s)) {
    return { postedAt: toIsoDate(anchor - n * 365 * MS_PER_DAY), granularity: "YEAR" };
  }

  return { postedAt: null, granularity: "UNKNOWN" };
}

export type PostedComparison = "NEWER" | "SAME" | "OLDER" | "UNKNOWN";

/**
 * So sánh ngày đăng của bản MỚI với bản ĐANG LƯU.
 *
 * Dung sai lấy theo bên THÔ HƠN: so "2 weeks ago" với "2026-08-02" thì phải chấp nhận
 * sai số 7 ngày, vì bản thân chuỗi "2 weeks ago" chỉ chính xác tới tuần.
 * Thiếu ngày ở một trong hai bên -> UNKNOWN, để bên gọi chọn phương án an toàn.
 */
export function comparePostedDate(
  next: ParsedPostedDate,
  prev: ParsedPostedDate
): PostedComparison {
  if (!next.postedAt || !prev.postedAt) return "UNKNOWN";

  const diffDays = Math.round(
    (Date.parse(`${next.postedAt}T00:00:00Z`) - Date.parse(`${prev.postedAt}T00:00:00Z`)) / MS_PER_DAY
  );
  const tolerance = Math.max(TOLERANCE_DAYS[next.granularity], TOLERANCE_DAYS[prev.granularity]);

  if (diffDays > tolerance) return "NEWER";
  if (diffDays < -tolerance) return "OLDER";
  return "SAME";
}
