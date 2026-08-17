/**
 * Checkpoint & Smart Resume cho bộ cào tự động.
 *
 * VẤN ĐỀ GỐC: navigateToNextPage() cũ bấm nút phân trang rồi `await sleep()`.
 * Nếu cú bấm gây hard navigation, document bị huỷ ngay giữa lúc `await` —
 * Promise đó KHÔNG bao giờ resolve cũng KHÔNG reject, không exception nào bắt được.
 * Vòng cào chết im lặng. Hành vi phụ thuộc LinkedIn dùng pushState hay reload,
 * tức là BẤT ĐỊNH.
 *
 * GIẢI PHÁP: chủ động điều hướng bằng location.assign(&start=N) và coi việc content
 * script được nạp lại là MỘT BƯỚC CHUYỂN TRẠNG THÁI HỢP LỆ, không phải tai nạn.
 * Trạng thái nằm trong chrome.storage.local nên sống sót qua reload/đóng tab.
 */

const JH_CKPT_KEY = "jhCrawlCheckpoint";
const JH_PAGE_SIZE = 25; // LinkedIn phân trang 25 job/trang (start=0,25,50,...)
const JH_EXPECT_TTL_MS = 120_000; // vé điều hướng chỉ có hiệu lực 2 phút
const JH_STALE_MS = 90_000; // quá lâu không nhịp tim -> coi như phiên đứt

/* ------------------------------------------------------------------ *
 * Cờ dừng nằm ở RAM (không phải storage)
 *
 * chrome.storage.local.set KHÔNG có compare-and-set. Nếu để cờ dừng trong
 * storage, vòng cào (ghi đè cả blob sau mỗi thẻ) sẽ ghi đè trạng thái PAUSED
 * mà nút Dừng vừa đặt, chỉ sau 1-2 giây. Nút Dừng trở thành vô dụng và crawler
 * tiếp tục điều hướng xuyên qua cả captcha — đúng kiểu hành vi khiến tài khoản
 * bị hạn chế.
 * ------------------------------------------------------------------ */
let jhStopRequested = false;

function jhRequestStop() {
  jhStopRequested = true;
}
function jhClearStopRequest() {
  jhStopRequested = false;
}
function jhIsStopRequested() {
  return jhStopRequested;
}

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[JH_CKPT_KEY]) return;
    const nv = changes[JH_CKPT_KEY].newValue;
    // Phiên bị xoá hoặc chuyển sang trạng thái không phải RUNNING -> dừng ngay
    if (!nv || nv.status !== "RUNNING") jhStopRequested = true;
  });
} catch (e) {}

/* ------------------------------------------------------------------ *
 * Định danh phiên tìm kiếm
 * ------------------------------------------------------------------ */

/**
 * Khoá nhận dạng một phiên tìm kiếm.
 * PHẢI loại `currentJobId` (mỗi lần click thẻ là URL đổi) và `start`
 * (mỗi trang một giá trị) — nếu không thì mỗi lần bootstrap đều thấy
 * "tìm kiếm khác" và từ chối resume.
 */
function jhSearchKey(href) {
  try {
    const u = new URL(href || location.href);
    const keep = ["keywords", "location", "geoId", "f_TPR", "f_WT", "f_E", "f_AL", "sortBy"];
    const parts = keep
      .map((k) => {
        const v = u.searchParams.get(k);
        return v ? `${k}=${v.toLowerCase().trim()}` : null;
      })
      .filter(Boolean);
    return `${u.pathname.replace(/\/+$/, "")}?${parts.join("&")}`;
  } catch (e) {
    return String(href || "");
  }
}

function jhGetStartOffset(href) {
  try {
    const v = new URL(href || location.href).searchParams.get("start");
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

/** Dựng URL trang kế, giữ nguyên mọi bộ lọc, bỏ currentJobId của trang cũ. */
function jhBuildPageUrl(href, startOffset) {
  try {
    const u = new URL(href || location.href);
    u.searchParams.delete("currentJobId");
    u.searchParams.set("start", String(startOffset));
    return u.toString();
  } catch (e) {
    return href;
  }
}

/**
 * Lấy LinkedIn job id từ một thẻ trong danh sách (kể cả thẻ bị occlude).
 * Uỷ quyền cho lib/selectors.js — bản cũ ở đây KHÔNG nhận data-job-id, nên khi
 * LinkedIn dùng thuộc tính đó thì phép bỏ-qua-thẻ-đã-xử-lý luôn thấy null và
 * crawler click lại thẻ cũ sau mỗi lần nạp trang.
 */
function jhCardJobId(card) {
  return jhCardJobIdFrom(card);
}

/* ------------------------------------------------------------------ *
 * Đọc / ghi checkpoint
 * ------------------------------------------------------------------ */

function jhStoreGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (res) => {
        void chrome.runtime.lastError;
        resolve(res || {});
      });
    } catch (e) {
      resolve({});
    }
  });
}

function jhStoreSet(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => {
        void chrome.runtime.lastError;
        resolve(true);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

async function jhCkptLoad() {
  const res = await jhStoreGet([JH_CKPT_KEY]);
  return res[JH_CKPT_KEY] || null;
}

/**
 * Ghi checkpoint theo kiểu read-modify-write.
 * Nếu trên đĩa đã là PAUSED/FINISHED mà ta định ghi đè bằng RUNNING thì TỪ CHỐI —
 * không bao giờ hồi sinh một phiên người dùng đã dừng.
 */
async function jhCkptSave(st) {
  const cur = await jhCkptLoad();
  if (
    cur &&
    cur.sessionId === st.sessionId &&
    cur.status !== "RUNNING" &&
    st.status === "RUNNING"
  ) {
    jhStopRequested = true;
    return false;
  }
  st.updatedAt = Date.now();
  st.heartbeatAt = Date.now();
  await jhStoreSet({ [JH_CKPT_KEY]: st });
  return true;
}

async function jhCkptClear() {
  return jhStoreSet({ [JH_CKPT_KEY]: null });
}

function jhCkptNew(href) {
  return {
    sessionId: `ck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    searchKey: jhSearchKey(href),
    searchUrl: href,
    pageIndex: Math.floor(jhGetStartOffset(href) / JH_PAGE_SIZE),
    startOffset: jhGetStartOffset(href),
    // Số trang phiên này THỰC SỰ đã đi qua. Khác pageIndex — cái đó suy ra từ
    // ?start= của URL, nên cào từ trang 3 là pageIndex đã bằng 2 ngay từ đầu.
    pagesDone: 0,
    cardIndex: 0,
    cardsOnPage: 0,
    savedCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
    seen: [],
    status: "RUNNING",
    stopReason: null,
    expect: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    heartbeatAt: Date.now(),
  };
}

/** Phiên đang RUNNING nhưng lâu không có nhịp tim -> tab bị đóng/crash giữa chừng. */
function jhCkptIsStale(st) {
  if (!st || st.status !== "RUNNING") return false;
  return Date.now() - (st.heartbeatAt || st.updatedAt || 0) > JH_STALE_MS;
}

/**
 * Có tiếp tục được không.
 * Kịch bản phổ biến nhất — đóng tab giữa chừng — KHÔNG ai kịp ghi PAUSED_*,
 * trạng thái trên đĩa vẫn là RUNNING. Thiếu nhánh `stale` thì thẻ "Tiếp tục"
 * bị ẩn đúng lúc cần nhất.
 */
function jhCkptIsResumable(st) {
  if (!st) return false;
  if (jhCkptIsStale(st)) return true;
  if (String(st.status).startsWith("PAUSED")) return true;
  return st.status !== "RUNNING" && st.savedCount > 0;
}

/* ------------------------------------------------------------------ *
 * Bắt tay điều hướng: phân biệt "ta tự đi" với "người dùng mở trang"
 * ------------------------------------------------------------------ */

/** Cấp vé trước khi location.assign để lần nạp sau biết đây là bước của mình. */
function jhCkptIssueExpect(st, startOffset) {
  st.expect = { start: startOffset, issuedAt: Date.now() };
  return st;
}

/**
 * Lần nạp này có phải do chính crawler điều hướng tới không?
 *
 * `start` KHÔNG được dùng làm điều kiện chặn: nếu LinkedIn chuẩn hoá hoặc bỏ
 * tham số start thì crawler sẽ hỏi lại người dùng sau MỖI trang, vô hiệu hoá
 * toàn bộ tính năng. Lệch start chỉ ghi nhận để chốt chặn phân xử.
 */
function jhCkptIsOurNavigation(st, href) {
  if (!st || st.status !== "RUNNING" || !st.expect) return false;
  if (st.searchKey !== jhSearchKey(href)) return false;
  return Date.now() - st.expect.issuedAt < JH_EXPECT_TTL_MS;
}

async function jhCkptPause(st, status, reason) {
  st.status = status;
  st.stopReason = reason;
  st.expect = null;
  st.updatedAt = Date.now();
  await jhStoreSet({ [JH_CKPT_KEY]: st });
  jhStopRequested = true;
  return st;
}

async function jhCkptFinish(st, reason) {
  st.status = "FINISHED";
  st.stopReason = reason;
  st.expect = null;
  st.updatedAt = Date.now();
  await jhStoreSet({ [JH_CKPT_KEY]: st });
  return st;
}

/** Mô tả ngắn để hiện lên nút "Tiếp tục". */
function jhCkptSummary(st) {
  if (!st) return "";
  return `Trang ${(st.pageIndex || 0) + 1}, đã lưu ${st.savedCount || 0} việc`;
}

/* ------------------------------------------------------------------ *
 * Đồng bộ telemetry lên máy chủ
 *
 * TUYỆT ĐỐI không chặn vòng cào: máy chủ tắt hoặc đang hot-reload chỉ làm mất
 * lịch sử, không được làm hỏng phiên cào. Bắt buộc có timeout — Firefox có thể
 * hủy event page đúng lúc `await`, khiến Promise treo vĩnh viễn.
 * ------------------------------------------------------------------ */

function jhSendMessageWithTimeout(msg, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish({ success: false, timedOut: true }), timeoutMs);
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        clearTimeout(timer);
        void chrome.runtime.lastError;
        finish(res || { success: false });
      });
    } catch (e) {
      clearTimeout(timer);
      finish({ success: false });
    }
  });
}

/** Bắn tiến trình phiên lên máy chủ, không chờ kết quả. */
function jhCkptSyncToServer(st, jobs) {
  if (!st) return;
  void jhSendMessageWithTimeout(
    {
      action: "SYNC_CRAWL_STATE",
      payload: {
        session: {
          sessionId: st.sessionId,
          searchKey: st.searchKey,
          searchUrl: st.searchUrl,
          pageIndex: st.pageIndex,
          startOffset: st.startOffset,
          cardIndex: st.cardIndex,
          savedCount: st.savedCount,
          rejectedCount: st.rejectedCount,
          status: st.status,
          stopReason: st.stopReason,
        },
        jobs: jobs || [],
      },
    },
    3000
  );
}
