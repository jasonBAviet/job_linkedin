/**
 * Background Service Worker cho WebExtension
 * Hỗ trợ định tuyến kết nối an toàn đến máy chủ Dashboard, tương thích cả Chrome & Firefox.
 *
 * Lưu ý MV3: worker (Chrome) và event page (Firefox) đều bị hủy giữa các sự kiện.
 * Vì vậy MỌI listener phải được đăng ký đồng bộ ở top-level, và trạng thái phiên cào
 * phải nằm trong chrome.storage chứ không phải biến module-level.
 */

const DEFAULT_BACKEND_URL = "http://localhost:3000";
const DASHBOARD_TAB_PATTERNS = ["http://localhost/*", "http://127.0.0.1/*"];

function getResolvedServerUrl(preferredUrl, callback) {
  if (preferredUrl && typeof preferredUrl === "string" && preferredUrl.trim() !== "") {
    callback(preferredUrl.trim().replace(/\/+$/, ""));
    return;
  }

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["serverUrl"], (res) => {
        if (chrome.runtime.lastError || !res || !res.serverUrl) {
          callback(DEFAULT_BACKEND_URL);
        } else {
          callback(String(res.serverUrl).trim().replace(/\/+$/, ""));
        }
      });
      return;
    }
  } catch (err) {
    console.error("Lỗi khi đọc chrome.storage:", err);
  }

  callback(DEFAULT_BACKEND_URL);
}

// Khởi tạo cấu hình ban đầu
try {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["serverUrl"], (res) => {
          if (!res || !res.serverUrl) {
            chrome.storage.local.set({ serverUrl: DEFAULT_BACKEND_URL });
          }
        });
      }
    });
  }
} catch (e) {
  console.warn("Không thể đăng ký onInstalled listener:", e);
}

/* ------------------------------------------------------------------ *
 * Dựng và kiểm duyệt URL tìm kiếm LinkedIn
 *
 * Trang Dashboard KHÔNG BAO GIỜ được gửi URL sang. Nó chỉ gửi bộ lọc dạng
 * enum, background tự dựng URL rồi tự kiểm tra lại URL vừa dựng.
 * ------------------------------------------------------------------ */

const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);
const LINKEDIN_SEARCH_PATHS = new Set(["/jobs/search", "/jobs/search-results"]);

const LI_LOCATION_QUERY = {
  HO_CHI_MINH: "Ho Chi Minh City, Vietnam",
  DONG_NAI: "Dong Nai, Vietnam",
  REMOTE: "Vietnam",
  HYBRID: "Vietnam",
  ALL: "Vietnam",
};

const LI_ROLE_KEYWORD = {
  DATA_ANALYST: "Data Analyst",
  BUSINESS_ANALYST: "Business Analyst",
  HYBRID_BA_DA: "Business Analyst OR Data Analyst",
  ALL: "Business Analyst",
};

const LI_TIME_POSTED = {
  PAST_24H: "r86400",
  PAST_WEEK: "r604800",
  PAST_MONTH: "r2592000",
};

const LI_WORK_TYPE = { ON_SITE: "1", REMOTE: "2", HYBRID: "3" };

const LI_EXPERIENCE = {
  INTERN: "1",
  FRESHER: "2",
  JUNIOR: "3",
  MIDDLE: "4",
  SENIOR: "4",
  LEAD_MANAGER: "5,6",
};

function isLinkedInJobsSearchUrl(input) {
  if (typeof input !== "string" || input.length > 2000) return false;

  let url;
  try {
    url = new URL(input);
  } catch (e) {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  if (!LINKEDIN_HOSTS.has(url.hostname.toLowerCase())) return false;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  return LINKEDIN_SEARCH_PATHS.has(path);
}

function isLinkedInAuthWallUrl(input) {
  try {
    const path = new URL(input).pathname.toLowerCase();
    return /^\/(authwall|login|checkpoint|signup|uas\/login)/.test(path);
  } catch (e) {
    return false;
  }
}

function buildLinkedInSearchUrl(filters) {
  const f = filters && typeof filters === "object" ? filters : {};
  const url = new URL("https://www.linkedin.com/jobs/search/");

  const keyword =
    (typeof f.keyword === "string" && f.keyword.trim()) ||
    LI_ROLE_KEYWORD[f.roleCategory] ||
    LI_ROLE_KEYWORD.ALL;
  url.searchParams.set("keywords", keyword.slice(0, 200));
  url.searchParams.set("location", LI_LOCATION_QUERY[f.location] || LI_LOCATION_QUERY.ALL);

  if (LI_TIME_POSTED[f.datePosted]) {
    url.searchParams.set("f_TPR", LI_TIME_POSTED[f.datePosted]);
  }

  const workType =
    LI_WORK_TYPE[f.workMode] ||
    (f.location === "REMOTE" ? "2" : f.location === "HYBRID" ? "3" : null);
  if (workType) url.searchParams.set("f_WT", workType);

  if (LI_EXPERIENCE[f.seniority]) url.searchParams.set("f_E", LI_EXPERIENCE[f.seniority]);
  if (f.isEasyApply === true) url.searchParams.set("f_AL", "true");

  url.searchParams.set("sortBy", "DD");

  const built = url.toString();
  return isLinkedInJobsSearchUrl(built) ? built : null;
}

/* ------------------------------------------------------------------ *
 * Trạng thái phiên cào (bền vững qua các lần worker bị hủy)
 * ------------------------------------------------------------------ */

const SESSION_KEY = "jhCrawlSession";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// storage.session không ghi ra đĩa và tự xóa khi đóng trình duyệt (Chrome 102+, Firefox 115+)
const sessionArea =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.session
    ? chrome.storage.session
    : chrome.storage.local;

function loadSession(callback) {
  sessionArea.get([SESSION_KEY], (res) => {
    const session = (!chrome.runtime.lastError && res && res[SESSION_KEY]) || null;
    if (session && Date.now() - (session.createdAt || 0) > SESSION_TTL_MS) {
      clearSession(() => callback(null));
      return;
    }
    callback(session);
  });
}

function saveSession(session, callback) {
  session.updatedAt = Date.now();
  sessionArea.set({ [SESSION_KEY]: session }, () => {
    void chrome.runtime.lastError;
    if (callback) callback(session);
  });
}

function clearSession(callback) {
  sessionArea.remove([SESSION_KEY], () => {
    void chrome.runtime.lastError;
    if (callback) callback();
  });
}

/**
 * Phát sự kiện tới mọi tab Dashboard đang mở.
 * Truy vấn theo nhu cầu thay vì nhớ một dashboardTabId cố định — tự lành khi
 * người dùng F5 hoặc mở dashboard ở tab thứ hai.
 */
function broadcastToDashboards(event, payload) {
  chrome.tabs.query({ url: DASHBOARD_TAB_PATTERNS }, (tabs) => {
    if (chrome.runtime.lastError || !tabs) return;
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { __jhEvent: 1, event, payload }, () => {
        void chrome.runtime.lastError; // tab chưa có bridge — bỏ qua yên lặng
      });
    }
  });
}

let lastCrawlOpenAt = 0; // rate-limit tạm thời, mất khi worker bị hủy là chấp nhận được

/**
 * Đẩy lệnh bắt đầu xuống một tab LinkedIn ĐÃ tải xong từ trước.
 *
 * Với tab mới mở thì cơ chế bắt tay CONTENT_READY lo liệu. Nhưng khi tái dùng
 * tab đang mở, content script đã announce từ lâu và sẽ không announce lại — nên
 * ở đây phải đẩy xuống, kèm retry phòng khi tab vừa điều hướng.
 */
function sendStartWithRetry(tabId, payload, attempt = 0) {
  chrome.tabs.sendMessage(tabId, { action: "START_AUTO_CRAWL", ...payload }, (res) => {
    if (chrome.runtime.lastError || !res) {
      if (attempt < 8) {
        setTimeout(() => sendStartWithRetry(tabId, payload, attempt + 1), 500 + attempt * 300);
      }
    }
  });
}

/** Tab LinkedIn đang hoạt động ở cửa sổ hiện tại, nếu có. */
function findActiveLinkedInTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || !tabs[0]) {
      callback(null);
      return;
    }
    const tab = tabs[0];
    // Chỉ nhận trang THỰC SỰ có danh sách việc làm. Regex cũ (`/jobs`) nhận cả
    // /jobs/view/{id} và /jobs/my-items/... khiến popup khởi động cào trên trang
    // không hề có thẻ nào rồi báo lỗi khó hiểu.
    const isJobsList =
      tab.url &&
      /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\/jobs\/(search|search-results|collections)/i.test(
        tab.url
      );
    callback(isJobsList ? tab : null);
  });
}

/* ---- Chế độ ghi (thu thập theo cuộn trang) ---- */

const PASSIVE_COUNT_KEY = "jhPassiveCount";
// Mốc ghi gần nhất trên MỌI tab. Phải toàn cục: một tab LinkedIn ngồi không
// không được phép kết luận là "đã xong" khi tab khác vẫn đang ghi đều.
const PASSIVE_LAST_SAVE_KEY = "jhPassiveLastSaveAt";
// Khớp JH_PASSIVE_CONFIG.AUTO_OFF_IDLE_MS bên lib/passive-harvester.js
const JH_AUTO_OFF_IDLE_MS = 120000;

// Phải khớp bản sao trong lib/passive-harvester.js — content script và service
// worker là hai ngữ cảnh tách rời, không dùng chung được hằng số.
const JH_RECORD_KEY = "jhRecordEnabled";
const JH_AUTO_OPEN_KEY = "jhAutoOpenEnabled";
const JH_LEGACY_PASSIVE_KEY = "passiveEnabled";

/**
 * Đọc trạng thái hai tầng công tắc.
 *
 * `=== true` chứ KHÔNG phải `!== false`: chế độ ghi là opt-in, chưa từng bật thì
 * phải là TẮT. Ngữ nghĩa cũ (`!== false`) chính là thứ khiến extension tự cào
 * ngay khi người dùng cuộn mà không ai bật.
 */
function loadPassiveState(callback) {
  chrome.storage.local.get([JH_RECORD_KEY, JH_AUTO_OPEN_KEY], (local) => {
    const ok = !chrome.runtime.lastError && local;
    const enabled = !!ok && local[JH_RECORD_KEY] === true;
    const autoOpen = !!ok && local[JH_AUTO_OPEN_KEY] === true;

    sessionArea.get([PASSIVE_COUNT_KEY], (session) => {
      const savedCount = (!chrome.runtime.lastError && session && session[PASSIVE_COUNT_KEY]) || 0;
      // Tầng phụ không bao giờ được coi là bật khi tầng chính đang tắt.
      callback({ enabled, autoOpen: enabled && autoOpen, savedCount });
    });
  });
}

/** Áp chế độ ghi cho MỌI tab LinkedIn đang mở, không chỉ tab hiện tại. */
function applyPassiveToAllLinkedInTabs(enabled, autoOpen) {
  chrome.tabs.query({ url: ["*://*.linkedin.com/*"] }, (tabs) => {
    if (chrome.runtime.lastError || !tabs) return;
    for (const tab of tabs) {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "SET_PASSIVE_ENABLED", enabled, autoOpen },
        () => {
          void chrome.runtime.lastError;
        }
      );
    }
  });
}

/**
 * Ghi trạng thái mới rồi đồng bộ ra mọi bề mặt: storage -> các tab LinkedIn ->
 * Dashboard. Mọi đường đổi trạng thái (popup, widget, dashboard, tự tắt) đều đi
 * qua đây để không có bề mặt nào hiển thị lệch.
 */
function commitPassiveState(enabled, autoOpen, callback) {
  const next = { [JH_RECORD_KEY]: !!enabled, [JH_AUTO_OPEN_KEY]: !!enabled && !!autoOpen };

  loadPassiveState((prev) => {
    // CHỈ khi thực sự chuyển tắt -> bật. Đặt lại ở mọi lần ghi trạng thái sẽ xoá
    // sạch số đã ghi chỉ vì người dùng gạt tầng tự mở JD giữa chừng.
    const startsNewBatch = !!enabled && !prev.enabled;

    chrome.storage.local.set(next, () => {
      void chrome.runtime.lastError;

      // Mẻ mới -> đếm lại từ 0 cho khớp toast "đã ghi xong N việc làm", và tính
      // mốc im lặng từ chính lúc bật chứ không từ lần ghi của mẻ trước.
      const resetCount = startsNewBatch
        ? (done) =>
            sessionArea.set(
              { [PASSIVE_COUNT_KEY]: 0, [PASSIVE_LAST_SAVE_KEY]: Date.now() },
              () => {
                void chrome.runtime.lastError;
                done();
              }
            )
        : (done) => done();

      resetCount(() => {
        applyPassiveToAllLinkedInTabs(next[JH_RECORD_KEY], next[JH_AUTO_OPEN_KEY]);
        loadPassiveState((state) => {
          broadcastToDashboards("PASSIVE_PROGRESS", {
            phase: enabled ? "enabled" : "disabled",
            enabled: state.enabled,
            autoOpen: state.autoOpen,
            savedCount: state.savedCount,
          });
          if (callback) callback(state);
        });
      });
    });
  });
}

/* ------------------------------------------------------------------ *
 * Listener chính
 * ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Chẩn đoán dò danh sách việc làm. Ghi ở đây vì console của trang bị xoá sạch
  // sau mỗi lần chuyển trang, còn console service worker thì không.
  if (request.action === "CRAWL_DIAGNOSTIC") {
    console.warn("[JobHunter][diag]", request.diag);
    sendResponse({ ok: true });
    return true;
  }

  // Kiểm tra kết nối máy chủ — CHỈ đọc, không ghi bất kỳ dữ liệu nào vào kho việc làm
  if (request.action === "CHECK_HEALTH") {
    getResolvedServerUrl(request.serverUrl, (targetServerUrl) => {
      fetch(`${targetServerUrl}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
        .then((response) => {
          sendResponse({ success: response.ok, status: response.status, targetServerUrl });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: `Không thể kết nối đến ${targetServerUrl} (${error.message || "Lỗi mạng"}).`,
            targetServerUrl,
          });
        });
    });

    return true;
  }

  /* ---- Telemetry phiên cào: mất cũng không sao, KHÔNG được chặn vòng cào ---- */
  if (request.action === "SYNC_CRAWL_STATE") {
    getResolvedServerUrl(request.serverUrl, (targetServerUrl) => {
      fetch(`${targetServerUrl}/api/crawl-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload || {}),
      })
        .then(async (response) => {
          let json = null;
          try {
            json = await response.json();
          } catch (e) {}
          sendResponse({ success: response.ok, status: response.status, data: json });
        })
        .catch((error) => {
          // Máy chủ tắt hoặc đang hot-reload -> chỉ mất lịch sử
          sendResponse({ success: false, status: 0, error: String(error && error.message) });
        });
    });

    return true;
  }

  if (request.action === "SYNC_JOB_TO_BACKEND") {
    getResolvedServerUrl(request.serverUrl, (targetServerUrl) => {
      const endpoint = `${targetServerUrl}/api/jobs/import`;

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.payload || {}),
      })
        .then(async (response) => {
          try {
            const json = await response.json();
            sendResponse({ success: response.ok, data: json, targetServerUrl });
          } catch (parseErr) {
            sendResponse({
              success: response.ok,
              data: { message: `Máy chủ phản hồi HTTP ${response.status}` },
              targetServerUrl,
            });
          }
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: `Không thể kết nối đến máy chủ ${targetServerUrl} (${error.message || "Lỗi mạng"}). Vui lòng đảm bảo máy chủ http://localhost:3000 đang hoạt động.`,
          });
        });
    });

    return true; // Giữ cổng kết nối bất đồng bộ cho sendResponse
  }

  /* ---- Điều khiển cào từ xa: Dashboard bấm nút -> mở tab LinkedIn ---- */

  if (request.action === "OPEN_LINKEDIN_AND_CRAWL") {
    const now = Date.now();
    if (now - lastCrawlOpenAt < 5000) {
      sendResponse({ success: false, code: "RATE_LIMITED" });
      return true;
    }

    const searchUrl = buildLinkedInSearchUrl(request.filters);
    if (!searchUrl) {
      sendResponse({ success: false, code: "INVALID_FILTERS" });
      return true;
    }

    const dashboardTabId = (sender.tab && sender.tab.id) || null;

    /**
     * Tái dùng tab LinkedIn người dùng đang mở thay vì mở thêm tab mới.
     * Popup dùng đường này (preferActiveTab), Dashboard thì không — vì tab
     * đang hoạt động của Dashboard chính là Dashboard.
     */
    const reuseTab = (tab) => {
      lastCrawlOpenAt = Date.now();
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      saveSession(
        {
          id: sessionId,
          status: "WAITING_CONTENT",
          crawlTabId: tab.id,
          dashboardTabId,
          searchUrl: tab.url,
          origin: request.origin || "POPUP",
          crawledCount: 0,
          pageNumber: 1,
          limits: request.limits || {},
          createdAt: Date.now(),
          error: null,
        },
        () => {
          sendStartWithRetry(tab.id, { sessionId, origin: request.origin || "POPUP" });
          sendResponse({
            success: true,
            payload: { sessionId, tabId: tab.id, reusedTab: true, searchUrl: tab.url },
          });
        }
      );
    };

    const openCrawlTab = () => {
      lastCrawlOpenAt = Date.now();
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Ghi state PENDING TRƯỚC khi tạo tab: nếu content script kịp gửi
      // CONTENT_READY quá sớm thì nó vẫn tìm thấy phiên và được bảo thử lại.
      saveSession(
        {
          id: sessionId,
          status: "PENDING",
          crawlTabId: null,
          dashboardTabId,
          searchUrl,
          crawledCount: 0,
          pageNumber: 1,
          limits: request.limits || {},
          createdAt: Date.now(),
          error: null,
        },
        () => {
          chrome.tabs.create(
            {
              url: searchUrl,
              active: true,
              openerTabId: dashboardTabId || undefined,
            },
            (tab) => {
              if (chrome.runtime.lastError || !tab) {
                clearSession(() => sendResponse({ success: false, code: "TAB_CREATE_FAILED" }));
                return;
              }

              loadSession((current) => {
                if (!current || current.id !== sessionId) {
                  sendResponse({ success: true, payload: { sessionId, searchUrl } });
                  return;
                }
                current.crawlTabId = tab.id;
                if (current.status === "PENDING") current.status = "WAITING_CONTENT";
                saveSession(current, () =>
                  sendResponse({ success: true, payload: { sessionId, searchUrl, tabId: tab.id } })
                );
              });
            }
          );
        }
      );
    };

    const startFresh = () => {
      if (!request.preferActiveTab) {
        openCrawlTab();
        return;
      }
      findActiveLinkedInTab((tab) => (tab ? reuseTab(tab) : openCrawlTab()));
    };

    loadSession((prev) => {
      if (prev && (prev.status === "WAITING_CONTENT" || prev.status === "RUNNING")) {
        chrome.tabs.get(prev.crawlTabId, (tab) => {
          if (!chrome.runtime.lastError && tab) {
            sendResponse({
              success: false,
              code: "ALREADY_RUNNING",
              payload: {
                tabId: prev.crawlTabId,
                crawledCount: prev.crawledCount || 0,
                pageNumber: prev.pageNumber || 1,
              },
            });
          } else {
            clearSession(startFresh); // phiên cũ mồ côi, tab đã đóng
          }
        });
        return;
      }
      startFresh();
    });

    return true;
  }

  /* ---- Chế độ thu thập theo cuộn trang ---- */

  if (request.action === "PASSIVE_PROGRESS") {
    sessionArea.get([PASSIVE_COUNT_KEY], (res) => {
      const previous = (!chrome.runtime.lastError && res && res[PASSIVE_COUNT_KEY]) || 0;
      // Bộ đếm của content script là theo từng tab; cộng dồn thành tổng toàn phiên.
      const isSave = request.phase !== "enabled" && request.phase !== "disabled";
      const total = isSave ? previous + 1 : previous;

      const patch = { [PASSIVE_COUNT_KEY]: total };
      if (isSave) patch[PASSIVE_LAST_SAVE_KEY] = Date.now();

      sessionArea.set(patch, () => {
        void chrome.runtime.lastError;
        broadcastToDashboards("PASSIVE_PROGRESS", {
          phase: request.phase,
          enabled: !!request.enabled,
          autoOpen: !!request.autoOpen,
          savedCount: total,
        });
        sendResponse({ ok: true, savedCount: total });
      });
    });

    return true;
  }

  /**
   * Một tab hết giờ im lặng và hỏi xem có được tắt chưa.
   *
   * Chỉ TRẢ LỜI, không tự tắt: việc tắt do chính tab hỏi thực hiện qua
   * autoOff() -> SET_PASSIVE_ENABLED, để toast "đã ghi xong N việc làm" hiện ra
   * đúng chỗ. Tắt ở đây thì lệnh fan-out sẽ disable tab đó trước, và autoOff()
   * thấy mình đã tắt nên nuốt luôn toast.
   */
  if (request.action === "PASSIVE_IDLE_CHECK") {
    loadSession((session) => {
      // Bộ cào tự động đang chạy: nó gửi việc làm qua đường khác nên không dời
      // được mốc ghi gần nhất. Một tab LinkedIn ngồi không sẽ tưởng là đã xong
      // rồi tắt chế độ ghi ngay giữa lúc phiên cào còn đang chạy.
      const crawling =
        !!session && (session.status === "RUNNING" || session.status === "WAITING_CONTENT");
      if (crawling) {
        sendResponse({ offNow: false, retryInMs: JH_AUTO_OFF_IDLE_MS });
        return;
      }

      sessionArea.get([PASSIVE_LAST_SAVE_KEY], (res) => {
        const last = (!chrome.runtime.lastError && res && res[PASSIVE_LAST_SAVE_KEY]) || 0;
        const quietFor = Date.now() - last;

        if (!last || quietFor >= JH_AUTO_OFF_IDLE_MS) {
          sendResponse({ offNow: true });
          return;
        }
        sendResponse({ offNow: false, retryInMs: JH_AUTO_OFF_IDLE_MS - quietFor });
      });
    });

    return true;
  }

  if (request.action === "GET_PASSIVE_STATE") {
    loadPassiveState((state) => sendResponse({ success: true, payload: state }));
    return true;
  }

  if (request.action === "SET_PASSIVE_ENABLED") {
    const enabled = !!request.enabled;
    // Bên gửi có thể chỉ đổi tầng chính (popup, dashboard) và không nói gì về
    // tầng phụ -> giữ nguyên giá trị đang lưu thay vì âm thầm hạ nó về false.
    const hasAutoOpen = typeof request.autoOpen === "boolean";

    loadPassiveState((prev) => {
      const autoOpen = hasAutoOpen ? request.autoOpen : prev.autoOpen;
      commitPassiveState(enabled, autoOpen, (state) =>
        sendResponse({ success: true, payload: state })
      );
    });

    return true;
  }

  if (request.action === "SET_AUTO_OPEN_ENABLED") {
    // Tầng phụ vô nghĩa khi chưa bật chế độ ghi — từ chối thẳng thay vì bật hộ,
    // để không có đường nào bật thu thập mà người dùng chưa chủ động chọn.
    loadPassiveState((prev) => {
      if (!prev.enabled) {
        sendResponse({ success: false, code: "RECORD_OFF", payload: prev });
        return;
      }
      commitPassiveState(true, !!request.autoOpen, (state) =>
        sendResponse({ success: true, payload: state })
      );
    });

    return true;
  }

  /**
   * Bắt tay kiểu PULL: content script tự báo đã sẵn sàng.
   *
   * tabs.onUpdated status:"complete" bắn theo sự kiện load, KHÔNG đảm bảo
   * content script đã đăng ký xong onMessage listener. Để content script chủ
   * động hỏi thì race đó biến mất hoàn toàn.
   */
  if (request.action === "CONTENT_READY") {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ startCrawl: false });
      return true;
    }

    loadSession((session) => {
      if (!session) {
        sendResponse({ startCrawl: false });
        return;
      }

      // Callback của tabs.create chưa kịp chạy — bảo content script quay lại sau
      if (session.status === "PENDING" && session.crawlTabId == null) {
        sendResponse({ startCrawl: false, retryInMs: 600 });
        return;
      }

      if (session.crawlTabId !== tabId) {
        sendResponse({ startCrawl: false });
        return;
      }

      if (isLinkedInAuthWallUrl(request.url)) {
        // KHÔNG đóng tab, KHÔNG xóa phiên: người dùng đăng nhập ngay tại tab này,
        // LinkedIn điều hướng, content script announce lại và quá trình tự tiếp tục.
        session.status = "WAITING_CONTENT";
        session.error = "LINKEDIN_NOT_LOGGED_IN";
        saveSession(session, () => {
          broadcastToDashboards("CRAWL_ERROR", {
            sessionId: session.id,
            code: "LINKEDIN_NOT_LOGGED_IN",
            recoverable: true,
            message:
              "Chưa đăng nhập LinkedIn. Hãy đăng nhập trong tab vừa mở, quá trình cào sẽ tự tiếp tục.",
          });
          sendResponse({ startCrawl: false });
        });
        return;
      }

      if (session.status === "WAITING_CONTENT" || session.status === "RUNNING") {
        const resume = session.status === "RUNNING";
        session.status = "RUNNING";
        session.error = null;
        saveSession(session, () => {
          broadcastToDashboards(resume ? "CRAWL_PROGRESS" : "CRAWL_STARTED", {
            sessionId: session.id,
            isRunning: true,
            crawledCount: session.crawledCount,
            pageNumber: session.pageNumber,
          });
          sendResponse({
            startCrawl: true,
            sessionId: session.id,
            resume,
            limits: session.limits || {},
          });
        });
        return;
      }

      sendResponse({ startCrawl: false });
    });

    return true;
  }

  if (request.action === "CRAWL_PROGRESS") {
    const tabId = sender.tab && sender.tab.id;

    loadSession((existing) => {
      let session = existing;

      // Phiên cào có thể được kích hoạt từ widget nổi hoặc popup ngay trên tab
      // LinkedIn — khi đó chưa hề có session nào. Tự đăng ký session ở đây để
      // Dashboard và popup nhìn thấy cùng một trạng thái, bất kể ai bấm nút.
      if (request.phase === "start" && tabId && (!session || session.crawlTabId !== tabId)) {
        session = {
          id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: "RUNNING",
          crawlTabId: tabId,
          dashboardTabId: null,
          searchUrl: (sender.tab && sender.tab.url) || null,
          origin: request.origin || "WIDGET",
          crawledCount: 0,
          pageNumber: 1,
          limits: {},
          createdAt: Date.now(),
          error: null,
        };
      }

      if (!session || session.crawlTabId !== tabId) {
        sendResponse({ ok: false });
        return;
      }

      if (request.phase === "start") session.status = "RUNNING";
      if (typeof request.crawledCount === "number") session.crawledCount = request.crawledCount;
      if (typeof request.pageNumber === "number") session.pageNumber = request.pageNumber;

      const finished = request.phase === "done";
      if (finished) session.status = "DONE";

      saveSession(session, () => {
        broadcastToDashboards(
          finished ? "CRAWL_DONE" : request.phase === "start" ? "CRAWL_STARTED" : "CRAWL_PROGRESS",
          {
            sessionId: session.id,
            phase: request.phase,
            origin: session.origin,
            isRunning: !!request.isRunning,
            crawledCount: session.crawledCount,
            pageNumber: session.pageNumber,
            reason: request.reason || null,
          }
        );
        sendResponse({ ok: true });
      });
    });

    return true;
  }

  if (request.action === "STOP_REMOTE_CRAWL") {
    loadSession((session) => {
      if (!session) {
        sendResponse({ success: true, payload: { isRunning: false } });
        return;
      }

      chrome.tabs.sendMessage(session.crawlTabId, { action: "STOP_AUTO_CRAWL" }, () => {
        void chrome.runtime.lastError; // tab có thể đã đóng — vẫn phải kết thúc phiên

        session.status = "STOPPED";
        session.error = "USER_STOPPED";
        saveSession(session, () => {
          broadcastToDashboards("CRAWL_DONE", {
            sessionId: session.id,
            isRunning: false,
            crawledCount: session.crawledCount,
            code: "USER_STOPPED",
          });
          sendResponse({
            success: true,
            payload: { isRunning: false, crawledCount: session.crawledCount },
          });
        });
      });
    });

    return true;
  }

  if (request.action === "GET_REMOTE_STATUS") {
    loadSession((session) => {
      if (!session) {
        loadPassiveState((passive) =>
          sendResponse({ success: true, payload: { isRunning: false, status: "IDLE", passive } })
        );
        return;
      }

      // Tin trạng thái thật của tab hơn state đã lưu — worker có thể đã bỏ lỡ sự kiện cuối
      chrome.tabs.sendMessage(session.crawlTabId, { action: "GET_CRAWL_STATUS" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          if (session.status === "RUNNING" || session.status === "WAITING_CONTENT") {
            session.status = "STOPPED";
            session.error = "TAB_GONE";
            saveSession(session);
          }
          loadPassiveState((passive) =>
            sendResponse({
              success: true,
              payload: {
                isRunning: false,
                status: session.status,
                crawledCount: session.crawledCount,
                pageNumber: session.pageNumber,
                error: session.error,
                passive,
              },
            })
          );
          return;
        }

        session.crawledCount = res.crawledCount;
        session.pageNumber = res.pageNumber;
        session.status = res.isRunning ? "RUNNING" : session.status === "RUNNING" ? "DONE" : session.status;

        saveSession(session, () =>
          loadPassiveState((passive) =>
            sendResponse({
              success: true,
              payload: {
                isRunning: res.isRunning,
                status: session.status,
                sessionId: session.id,
                origin: session.origin,
                crawledCount: session.crawledCount,
                pageNumber: session.pageNumber,
                tabId: session.crawlTabId,
                error: session.error,
                passive,
              },
            })
          )
        );
      });
    });

    return true;
  }
});

/* ------------------------------------------------------------------ *
 * Vòng đời tab cào — phải đăng ký đồng bộ ở top-level
 * ------------------------------------------------------------------ */

/** Khớp `jhIsJobsPage()` bên content script: mọi đường dẫn dưới /jobs. */
function isLinkedInJobsPageUrl(url) {
  return (
    typeof url === "string" &&
    /^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\/jobs(\/|\?|#|$)/i.test(url)
  );
}

/**
 * Không còn tab nào đứng trên danh sách việc làm -> xong mẻ ghi, tự tắt.
 *
 * Bổ khuyết cho chốt "rời /jobs" bên content script: chốt đó bám poll trong
 * trang nên chỉ bắt được điều hướng SPA. Điều hướng cứng (gõ URL khác, bấm link
 * rời LinkedIn, đóng tab) giết content script trước khi nó kịp tắt, nên phải
 * bắt từ background — nơi duy nhất sống sót qua các lần tải trang.
 *
 * Để cờ bật mà không còn tab /jobs nào là dựng sẵn một cái bẫy: lần sau mở
 * LinkedIn lên là extension ghi ngay, dù người dùng đã quên mình từng bật.
 */
function autoOffIfNoJobsTab(excludeTabId) {
  loadPassiveState((state) => {
    if (!state.enabled) return;

    chrome.tabs.query({ url: ["*://*.linkedin.com/*"] }, (tabs) => {
      if (chrome.runtime.lastError) return;
      // Lọc tab vừa đóng/vừa rời đi cho chắc: thứ tự giữa sự kiện và tabs.query
      // không được đảm bảo, tab đó có thể vẫn còn trong kết quả với URL cũ.
      const stillOnJobs = (tabs || []).some(
        (t) => t.id !== excludeTabId && isLinkedInJobsPageUrl(t.url)
      );
      if (stillOnJobs) return;

      commitPassiveState(false, false);
    });
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  autoOffIfNoJobsTab(tabId);

  loadSession((session) => {
    if (!session || session.crawlTabId !== tabId) return;
    if (session.status !== "RUNNING" && session.status !== "WAITING_CONTENT") return;

    session.status = "STOPPED";
    session.error = "TAB_CLOSED";
    saveSession(session, () =>
      broadcastToDashboards("CRAWL_DONE", {
        sessionId: session.id,
        isRunning: false,
        crawledCount: session.crawledCount,
        code: "TAB_CLOSED",
      })
    );
  });
});

// Không truyền tham số filter thứ 2 cho addListener — API đó chỉ có ở Firefox
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.status && !changeInfo.url) return;

  // Một tab vừa rời khỏi danh sách việc làm. Chỉ xét khi URL thực sự đổi:
  // changeInfo.status bắn nhiều lần trong cùng một lần tải trang.
  if (changeInfo.url && !isLinkedInJobsPageUrl(changeInfo.url)) {
    autoOffIfNoJobsTab(tabId);
  }

  loadSession((session) => {
    if (!session || session.crawlTabId !== tabId) return;
    if (session.status !== "RUNNING" && session.status !== "WAITING_CONTENT") return;

    const url = changeInfo.url || (tab && tab.url) || "";
    if (!url) return;
    if (/^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) return;

    session.status = "STOPPED";
    session.error = "NAVIGATED_AWAY";
    saveSession(session, () =>
      broadcastToDashboards("CRAWL_DONE", {
        sessionId: session.id,
        isRunning: false,
        crawledCount: session.crawledCount,
        code: "NAVIGATED_AWAY",
      })
    );
  });
});

/**
 * Dọn khóa `passiveEnabled` của bản cũ.
 *
 * Bản cũ đọc nó theo kiểu opt-out nên `true` còn sót lại là vô hại với code mới
 * (code mới không đọc khóa này nữa), nhưng để lại thì lần gỡ lỗi sau sẽ có hai
 * khóa mâu thuẫn nằm cạnh nhau. Chạy ở cả onInstalled (bắt lần cập nhật) lẫn
 * onStartup (bắt máy đã cập nhật từ trước khi listener kịp đăng ký).
 */
function dropLegacyPassiveKey() {
  try {
    chrome.storage.local.remove([JH_LEGACY_PASSIVE_KEY], () => {
      void chrome.runtime.lastError;
    });
  } catch (e) {}
}

try {
  if (chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(dropLegacyPassiveKey);
  }
} catch (e) {}

// Cần cho nhánh dự phòng storage.local (storage.session vốn tự xóa)
try {
  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      clearSession();
      dropLegacyPassiveKey();
      // Chế độ ghi không được sống qua lần khởi động trình duyệt.
      commitPassiveState(false, false);
    });
  }
} catch (e) {}
