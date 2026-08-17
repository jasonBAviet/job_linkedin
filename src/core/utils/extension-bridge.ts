/**
 * Cầu nối phía trang web tới Chrome/Firefox Extension "LinkedIn Job Hunter Extractor".
 *
 * Trang web không gọi được chrome.runtime trực tiếp. Extension chèn `bridge.js`
 * vào trang này (content script) và hai bên trao đổi qua window.postMessage.
 *
 * Quan trọng: trang KHÔNG gửi URL LinkedIn. Nó chỉ gửi bộ lọc dạng enum, còn
 * extension tự dựng và tự kiểm duyệt URL — nên một trang bị XSS cũng không thể
 * bảo extension mở địa chỉ bất kỳ.
 */

const CHANNEL_OUT = "JH_PAGE_TO_EXT";
const CHANNEL_IN = "JH_EXT_TO_PAGE";
const DEFAULT_TIMEOUT_MS = 8000;
const PING_TIMEOUT_MS = 1500;

export type CrawlEventName =
  | "CRAWL_STARTED"
  | "CRAWL_PROGRESS"
  | "CRAWL_DONE"
  | "CRAWL_ERROR"
  | "PASSIVE_PROGRESS";

/** Nguồn kích hoạt phiên cào — dùng để hiển thị "ai đang cào" cho khớp ở mọi nơi. */
export type CrawlOrigin = "DASHBOARD" | "POPUP" | "WIDGET";

/**
 * Trạng thái hai tầng của chế độ ghi.
 * `autoOpen` chỉ có nghĩa khi `enabled` — background luôn hạ nó về false nếu tầng chính tắt.
 */
export interface PassiveState {
  enabled: boolean;
  autoOpen: boolean;
  savedCount: number;
}

export interface CrawlEventPayload {
  sessionId?: string;
  phase?: string;
  origin?: CrawlOrigin;
  isRunning?: boolean;
  crawledCount?: number;
  pageNumber?: number;
  reason?: string | null;
  code?: string;
  message?: string;
  recoverable?: boolean;
  /** Chỉ có ở sự kiện PASSIVE_PROGRESS */
  enabled?: boolean;
  autoOpen?: boolean;
  savedCount?: number;
}

export interface CrawlEvent {
  event: CrawlEventName;
  payload: CrawlEventPayload;
}

export interface ExtensionCrawlFilters {
  location?: string;
  roleCategory?: string;
  seniority?: string;
  datePosted?: string;
  workMode?: string;
  keyword?: string;
  isEasyApply?: boolean;
}

export interface BridgeResponse<T = Record<string, unknown>> {
  ok: boolean;
  code?: string;
  payload: T;
}

export interface RemoteCrawlStatus {
  isRunning?: boolean;
  status?: string;
  sessionId?: string;
  origin?: CrawlOrigin;
  crawledCount?: number;
  pageNumber?: number;
  error?: string | null;
  passive?: PassiveState;
}

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `jh-${crypto.randomUUID()}`;
  }
  return `jh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Gửi một yêu cầu và chờ phản hồi khớp requestId.
 */
function request<T = Record<string, unknown>>(
  type: string,
  payload: Record<string, unknown> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<BridgeResponse<T>> {
  if (!isBrowser()) {
    return Promise.resolve({ ok: false, code: "NO_WINDOW", payload: {} as T });
  }

  return new Promise((resolve) => {
    const requestId = newRequestId();
    let settled = false;

    const finish = (result: BridgeResponse<T>) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.__jobHunter !== 1 || data.channel !== CHANNEL_IN) return;
      if (data.requestId !== requestId) return;

      finish({ ok: !!data.ok, code: data.code, payload: (data.payload || {}) as T });
    };

    const timer = setTimeout(() => finish({ ok: false, code: "TIMEOUT", payload: {} as T }), timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage(
      { __jobHunter: 1, channel: CHANNEL_OUT, v: 1, requestId, type, payload },
      window.location.origin
    );
  });
}

/**
 * Phát hiện extension theo 2 tầng:
 *  1. Cờ đồng bộ trên <html> do bridge.js đặt ở document_start.
 *  2. PING xác nhận bridge còn sống.
 *
 * "Có cờ nhưng ping timeout" nghĩa là content script đã mồ côi (extension vừa
 * được reload sau khi trang đã load) — coi như chưa cài và yêu cầu tải lại trang.
 */
export async function detectExtension(): Promise<{
  installed: boolean;
  version?: string;
  needsReload: boolean;
}> {
  if (!isBrowser()) return { installed: false, needsReload: false };

  const flagVersion = document.documentElement.getAttribute("data-jh-extension");
  const res = await request<{ installed?: boolean; version?: string }>("PING", {}, PING_TIMEOUT_MS);

  if (res.ok && res.payload.installed) {
    return { installed: true, version: res.payload.version || flagVersion || undefined, needsReload: false };
  }

  return { installed: false, needsReload: !!flagVersion };
}

export function startRemoteCrawl(
  filters: ExtensionCrawlFilters
): Promise<BridgeResponse<{ sessionId?: string; searchUrl?: string; tabId?: number; crawledCount?: number }>> {
  return request("OPEN_LINKEDIN_AND_CRAWL", { filters });
}

export function stopRemoteCrawl(): Promise<BridgeResponse<{ isRunning?: boolean; crawledCount?: number }>> {
  return request("STOP_REMOTE_CRAWL");
}

export function getRemoteStatus(): Promise<BridgeResponse<RemoteCrawlStatus>> {
  return request("GET_REMOTE_STATUS");
}

/**
 * Bật/tắt chế độ ghi trên mọi tab LinkedIn đang mở.
 *
 * Phải truyền `autoOpen` tường minh: bridge chỉ cho hai boolean này đi qua và
 * luôn ép về `=== true`, nên bỏ trống đồng nghĩa với "hạ tầng phụ xuống false".
 */
export function setPassiveEnabled(
  enabled: boolean,
  autoOpen: boolean
): Promise<BridgeResponse<PassiveState>> {
  return request("SET_PASSIVE_ENABLED", { enabled, autoOpen: enabled && autoOpen });
}

/** Bật/tắt riêng tầng tự mở JD khi cuộn. Bị từ chối (RECORD_OFF) nếu chế độ ghi đang tắt. */
export function setAutoOpenEnabled(autoOpen: boolean): Promise<BridgeResponse<PassiveState>> {
  return request("SET_AUTO_OPEN_ENABLED", { autoOpen });
}

/**
 * Đăng ký nhận sự kiện tiến trình cào do extension đẩy về.
 * Trả về hàm hủy đăng ký.
 */
export function onCrawlEvent(callback: (evt: CrawlEvent) => void): () => void {
  if (!isBrowser()) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.__jobHunter !== 1 || data.channel !== CHANNEL_IN) return;
    if (!data.event) return; // phản hồi request, không phải sự kiện đẩy

    callback({ event: data.event as CrawlEventName, payload: (data.payload || {}) as CrawlEventPayload });
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/** Thông điệp tiếng Việt cho từng mã lỗi trả về từ extension. */
export function describeBridgeError(code?: string): string {
  switch (code) {
    case "RATE_LIMITED":
      return "Bạn vừa bắt đầu một phiên cào. Vui lòng chờ vài giây rồi thử lại.";
    case "ALREADY_RUNNING":
      return "Đang có một phiên cào chạy dở. Hãy dừng phiên đó trước khi bắt đầu phiên mới.";
    case "INVALID_FILTERS":
      return "Bộ lọc hiện tại không dựng được đường dẫn tìm kiếm LinkedIn hợp lệ.";
    case "TAB_CREATE_FAILED":
      return "Không mở được tab LinkedIn. Hãy kiểm tra trình duyệt có chặn cửa sổ bật lên không.";
    case "LINKEDIN_NOT_LOGGED_IN":
      return "Chưa đăng nhập LinkedIn. Hãy đăng nhập trong tab vừa mở, quá trình cào sẽ tự tiếp tục.";
    case "TAB_CLOSED":
      return "Tab LinkedIn đã bị đóng nên phiên cào dừng lại.";
    case "NAVIGATED_AWAY":
      return "Tab cào đã rời khỏi LinkedIn nên phiên cào dừng lại.";
    case "TAB_GONE":
      return "Không còn tìm thấy tab đang cào.";
    case "RECORD_OFF":
      return "Hãy bật Chế độ ghi trước khi bật tự mở JD.";
    case "TIMEOUT":
    case "EXT_UNAVAILABLE":
      return "Không liên lạc được với Extension. Hãy tải lại trang rồi thử lại.";
    default:
      return "Không thực hiện được yêu cầu cào qua Extension.";
  }
}
