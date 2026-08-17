import crypto from "node:crypto";

/**
 * Khoá định danh việc làm — dùng chung cho migrate và runtime.
 *
 * Regex phải nhận cả 3 dạng, thiếu bất kỳ dạng nào sẽ bỏ sót bản ghi:
 *   /jobs/view/4123456789
 *   /jobs/view/senior-ba-at-fpt-4123456789   (có slug đứng trước)
 *   /jobs/search/?currentJobId=4123456789
 */
export function extractLinkedInJobId(url, fallbackId) {
  if (typeof url === "string" && url) {
    const viaPath = url.match(/\/jobs\/view\/(?:[^/?#]*?-)?(\d{6,})/);
    if (viaPath) return viaPath[1];
    const viaQuery = url.match(/[?&]currentJobId=(\d{6,})/);
    if (viaQuery) return viaQuery[1];
  }
  if (typeof fallbackId === "string") {
    const viaId = fallbackId.match(/^li-(\d{6,})$/);
    if (viaId) return viaId[1];
  }
  return null;
}

/** URL chính tắc: cùng một job trên /jobs/search và /jobs/view phải ra cùng một chuỗi. */
export function canonicalUrl(url, jobId) {
  if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  if (typeof url !== "string" || !url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/+$/, "/");
  } catch {
    return url.trim();
  }
}

/** Bỏ dấu tiếng Việt, hạ chữ thường, chỉ giữ chữ và số. */
export function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Khoá nội dung (dedupe tầng 3) — bắt được các bản trùng mà id/URL bỏ lọt,
 * vì id legacy nhúng Date.now() nên mỗi lần quét lại sinh id mới.
 */
export function contentKey(title, company, location) {
  const basis = `${slug(title)}|${slug(company)}|${slug(location)}`;
  return crypto.createHash("sha1").update(basis).digest("hex").slice(0, 24);
}

/** Độ tin cậy của nguồn — dùng khi gộp 2 bản trùng thì giữ bản đáng tin hơn. */
export const SOURCE_TRUST = {
  LINKEDIN_VOYAGER: 5,
  LINKEDIN_JSONLD: 4,
  LINKEDIN_DOM: 3,
  MANUAL_JD: 2,
  LINKEDIN_GUEST: 1,
};

export function sourceTrust(s) {
  return SOURCE_TRUST[s] || 0;
}
