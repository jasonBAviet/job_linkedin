/**
 * Khớp từ khóa có xét ranh giới từ, hỗ trợ cả tiếng Việt có dấu.
 *
 * Trước đây chỉ những từ khóa <= 4 ký tự mới được xét ranh giới, còn lại dùng
 * String.includes trần. Hệ quả là "Retail" khớp cả "retailer", "Statistics" khớp
 * "statistically", làm phát sinh kỹ năng không có thật trong JD.
 */

/** Ký tự được coi là thuộc về một từ: chữ Latin, chữ Việt có dấu và chữ số */
const WORD_CHAR_CLASS = "0-9A-Za-zÀ-ỹ";

const regexCache = new Map<string, RegExp>();

function buildBoundaryRegex(keyword: string): RegExp {
  const cached = regexCache.get(keyword);
  if (cached) return cached;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|[^${WORD_CHAR_CLASS}])${escaped}(?:$|[^${WORD_CHAR_CLASS}])`,
    "i"
  );
  regexCache.set(keyword, regex);
  return regex;
}

/**
 * Kiểm tra từ khóa có xuất hiện trong văn bản như một từ độc lập hay không.
 */
export function matchKeyword(text: string, keyword: string): boolean {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;
  return buildBoundaryRegex(kw).test(text);
}

/** Trả về true nếu bất kỳ từ khóa nào trong danh sách khớp văn bản */
export function matchAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => matchKeyword(text, kw));
}

/**
 * Tìm vị trí xuất hiện đầu tiên của từ khóa (theo ranh giới từ).
 * Trả về -1 nếu không tìm thấy. Dùng để lấy ngữ cảnh xung quanh từ khóa.
 */
export function findKeywordIndex(text: string, keyword: string): number {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return -1;

  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|[^${WORD_CHAR_CLASS}])(${escaped})(?:$|[^${WORD_CHAR_CLASS}])`,
    "i"
  );
  const match = regex.exec(text);
  if (!match) return -1;
  // match.index trỏ tới ký tự ngăn cách phía trước, cộng bù để trỏ đúng từ khóa
  return match.index + match[0].toLowerCase().indexOf(kw);
}
