/**
 * LinkedIn Job Hunter - Page Bridge
 * Cầu nối giữa trang Dashboard (localhost:3000) và Extension.
 *
 * Trang web KHÔNG thể gọi thẳng chrome.runtime.sendMessage, nên script này chạy
 * trong isolated world của trang Dashboard và làm trung gian hai chiều:
 *   trang  --window.postMessage-->  bridge  --chrome.runtime.sendMessage-->  background
 *   trang  <--window.postMessage--  bridge  <--chrome.tabs.sendMessage----  background
 *
 * Nguyên tắc bảo mật: chỉ chuyển tiếp các bộ lọc đã lọc sạch theo allowlist.
 * Tuyệt đối không chuyển tiếp URL hay serverUrl do trang cung cấp.
 */

(() => {
  // Chỉ chạy ở frame gốc — chặn kịch bản site khác nhúng dashboard vào iframe
  if (window.top !== window) return;

  const CHANNEL_IN = "JH_PAGE_TO_EXT";
  const CHANNEL_OUT = "JH_EXT_TO_PAGE";
  const BRIDGE_VERSION = "1.2.0";
  const PAGE_ORIGIN = window.location.origin;

  // manifest match theo mọi cổng localhost, nên phải tự chặn cổng ở runtime
  const allowedPorts = ["3000"];
  const isAllowedPort = () => allowedPorts.includes(window.location.port || "80");

  const FORWARDABLE_ACTIONS = new Set([
    "OPEN_LINKEDIN_AND_CRAWL",
    "STOP_REMOTE_CRAWL",
    "GET_REMOTE_STATUS",
    "GET_PASSIVE_STATE",
    "SET_PASSIVE_ENABLED",
    "SET_AUTO_OPEN_ENABLED",
  ]);

  /**
   * Đặt cờ đồng bộ để trang biết extension đã cài ngay từ lần render đầu của React.
   * Chạy ở document_start nên documentElement đã tồn tại.
   */
  try {
    const rootEl = document.documentElement;
    if (rootEl) {
      rootEl.setAttribute("data-jh-extension", BRIDGE_VERSION);
      rootEl.setAttribute("data-jh-browser", typeof browser !== "undefined" ? "firefox" : "chrome");
    }
  } catch (e) {}

  // Nới cổng hợp lệ nếu người dùng đã cấu hình serverUrl khác trong popup
  try {
    chrome.storage.local.get(["serverUrl"], (res) => {
      if (chrome.runtime.lastError || !res || !res.serverUrl) return;
      try {
        const port = new URL(res.serverUrl).port || "80";
        if (!allowedPorts.includes(port)) allowedPorts.push(port);
      } catch (e) {}
    });
  } catch (e) {}

  function postToPage(message) {
    try {
      window.postMessage(
        { __jobHunter: 1, channel: CHANNEL_OUT, v: 1, ...message },
        PAGE_ORIGIN
      );
    } catch (e) {}
  }

  /**
   * Chỉ giữ lại đúng các khóa bộ lọc đã biết, mọi thứ khác bị loại bỏ.
   * Background sẽ tự dựng URL LinkedIn từ bộ lọc này.
   */
  const ENUM_FIELDS = {
    location: ["ALL", "HO_CHI_MINH", "DONG_NAI", "REMOTE", "HYBRID"],
    roleCategory: ["ALL", "BUSINESS_ANALYST", "DATA_ANALYST", "HYBRID_BA_DA"],
    seniority: ["ALL", "INTERN", "FRESHER", "JUNIOR", "MIDDLE", "SENIOR", "LEAD_MANAGER"],
    datePosted: ["ALL", "PAST_24H", "PAST_WEEK", "PAST_MONTH"],
    workMode: ["ALL", "ON_SITE", "REMOTE", "HYBRID"],
  };

  function sanitiseFilters(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};

    for (const field of Object.keys(ENUM_FIELDS)) {
      const value = src[field];
      if (typeof value === "string" && ENUM_FIELDS[field].includes(value)) {
        out[field] = value;
      }
    }

    if (typeof src.keyword === "string") {
      const kw = src.keyword.trim().slice(0, 200);
      if (kw) out.keyword = kw;
    }

    if (src.isEasyApply === true) out.isEasyApply = true;

    return out;
  }

  function sanitiseLimits(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};
    const maxPages = Number(src.maxPages);
    if (Number.isFinite(maxPages)) {
      out.maxPages = Math.min(40, Math.max(1, Math.floor(maxPages)));
    }
    return out;
  }

  // ---- Chiều 1: trang -> extension ----
  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window) return;
      if (event.origin !== PAGE_ORIGIN) return;
      if (!isAllowedPort()) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.__jobHunter !== 1) return;
      // Bỏ qua chính message mình vừa gửi ra, tránh vòng lặp vô hạn
      if (data.channel !== CHANNEL_IN) return;
      if (typeof data.requestId !== "string" || !data.requestId || data.requestId.length > 64) return;

      const requestId = data.requestId;

      // PING trả lời tại chỗ, không đánh thức background
      if (data.type === "PING") {
        postToPage({
          requestId,
          ok: true,
          payload: {
            installed: true,
            version: BRIDGE_VERSION,
            capabilities: Array.from(FORWARDABLE_ACTIONS),
          },
        });
        return;
      }

      if (typeof data.type !== "string" || !FORWARDABLE_ACTIONS.has(data.type)) {
        postToPage({ requestId, ok: false, code: "UNSUPPORTED_TYPE" });
        return;
      }

      const payload = data.payload && typeof data.payload === "object" ? data.payload : {};
      const outbound = {
        action: data.type,
        origin: "DASHBOARD",
        filters: sanitiseFilters(payload.filters),
        limits: sanitiseLimits(payload.limits),
        // Hai trường boolean duy nhất được phép đi qua; mọi khóa khác đều bị loại.
        enabled: payload.enabled === true,
        autoOpen: payload.autoOpen === true,
      };

      try {
        chrome.runtime.sendMessage(outbound, (res) => {
          if (chrome.runtime.lastError) {
            postToPage({
              requestId,
              ok: false,
              code: "EXT_UNAVAILABLE",
              payload: { message: chrome.runtime.lastError.message || "" },
            });
            return;
          }
          postToPage({
            requestId,
            ok: !!(res && res.success),
            code: (res && res.code) || undefined,
            payload: (res && res.payload) || {},
          });
        });
      } catch (e) {
        postToPage({ requestId, ok: false, code: "EXT_UNAVAILABLE" });
      }
    },
    false
  );

  // ---- Chiều 2: background -> trang (đẩy tiến trình cào) ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.__jhEvent !== 1) return false;
    // Chỉ nhận từ chính extension này, và phải đến từ background (không có sender.tab)
    if (sender.id !== chrome.runtime.id) return false;
    if (sender.tab) return false;
    if (!isAllowedPort()) return false;

    postToPage({ event: message.event, payload: message.payload || {} });
    sendResponse({ ok: true });
    return false;
  });
})();
