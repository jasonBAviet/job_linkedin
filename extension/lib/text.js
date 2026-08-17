/**
 * Tiện ích xử lý văn bản khi bóc tách LinkedIn.
 *
 * LinkedIn render tiêu đề/địa điểm theo kiểu:
 *   <span aria-hidden="true">Senior BA</span><span class="visually-hidden">Senior BA</span>
 * nên innerText trả về "Senior BASenior BA". Phải khử tận gốc bằng cách gỡ node ẩn,
 * chứ không đoán bằng regex.
 */

const JH_A11Y_DUP_SELECTOR = [
  ".visually-hidden",
  ".a11y-text",
  ".screen-reader-text",
  '[class*="visually-hidden"]',
  '[class*="a11y-text"]',
].join(",");

/** Gộp chuỗi bị nhân đôi nguyên khối: "XX" -> "X" */
function jhCollapseDoubled(s) {
  const n = s.length;
  if (n < 6 || n % 2 !== 0) return s;
  const half = n / 2;
  return s.slice(0, half) === s.slice(half) ? s.slice(0, half) : s;
}

/** Bỏ dòng trống và dòng lặp liền kề */
function jhDedupeLines(text) {
  const out = [];
  for (const rawLine of text.split("\n")) {
    const line = jhCollapseDoubled(rawLine.trim());
    if (!line) continue;
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Lấy text sạch từ một node: clone -> gỡ node trợ năng trùng lặp -> chuẩn hoá khoảng trắng.
 */
function jhCleanText(node) {
  if (!node) return "";
  let source = node;
  try {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(JH_A11Y_DUP_SELECTOR).forEach((n) => n.remove());
    source = clone;
  } catch (e) {
    source = node;
  }
  const raw = (source.innerText || source.textContent || "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return jhDedupeLines(raw);
}

/** Tìm phần tử đầu tiên khớp trong danh sách selector, giới hạn trong `root`. */
function jhQueryFirst(root, selectors) {
  if (!root) return null;
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      /* selector không hợp lệ trên trình duyệt này -> bỏ qua */
    }
  }
  return null;
}

/** Lấy text sạch của selector đầu tiên khớp; trả "" nếu không có. */
function jhTextOf(root, selectors) {
  return jhCleanText(jhQueryFirst(root, selectors));
}

function jhSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chờ tới khi `predicate()` đúng hoặc hết thời gian. */
function jhWaitFor(predicate, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(() => {
      let done = false;
      try {
        done = !!predicate();
      } catch (e) {
        done = false;
      }
      if (done || Date.now() - started > timeoutMs) {
        clearInterval(iv);
        resolve(done);
      }
    }, 100);
  });
}
