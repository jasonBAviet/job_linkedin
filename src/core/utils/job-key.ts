import crypto from "node:crypto";

/**
 * Khoá định danh việc làm — bản TypeScript dùng ở runtime.
 * Phải khớp logic với scripts/lib/job-key.mjs (dùng lúc migrate), nếu lệch nhau
 * thì cùng một job sẽ sinh hai bản ghi khác nhau.
 */

/** Nhận cả /jobs/view/{id}, /jobs/view/{slug}-{id} và ?currentJobId={id} */
export function extractLinkedInJobId(url?: string | null, fallbackId?: string | null): string | null {
  if (url) {
    const viaPath = url.match(/\/jobs\/view\/(?:[^/?#]*?-)?(\d{6,})/);
    if (viaPath) return viaPath[1];
    const viaQuery = url.match(/[?&]currentJobId=(\d{6,})/);
    if (viaQuery) return viaQuery[1];
  }
  if (fallbackId) {
    const viaId = fallbackId.match(/^li-(\d{6,})$/);
    if (viaId) return viaId[1];
  }
  return null;
}

/** URL chính tắc: cùng một job trên /jobs/search và /jobs/view ra cùng chuỗi. */
export function canonicalUrl(url?: string | null, jobId?: string | null): string {
  if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  if (!url) return "";
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
export function slug(s?: string | null): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Khoá nội dung (dedupe tầng 3) — bắt trùng khi id/URL bỏ lọt. */
export function contentKey(title?: string | null, company?: string | null, location?: string | null): string {
  const basis = `${slug(title)}|${slug(company)}|${slug(location)}`;
  return crypto.createHash("sha1").update(basis).digest("hex").slice(0, 24);
}
