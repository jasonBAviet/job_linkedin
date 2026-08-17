/**
 * LinkedIn Job Hunter — NGUỒN SELECTOR DUY NHẤT cho việc dò danh sách việc làm.
 *
 * Trước đây ba nhóm selector bị nhân bản ở content.js / passive-harvester.js /
 * crawl-state.js và đã trôi lệch nhau (bản này nhận data-job-id, bản kia không;
 * container cuộn khác thứ tự ưu tiên). Gom hết về đây để không lệch tiếp.
 *
 * NẠP ĐẦU danh sách content_scripts (xem manifest.json). Mọi content script dùng
 * chung một global scope, kéo theo hai cái bẫy:
 *   - `const` trùng tên ở hai file -> SyntaxError, GIẾT CẢ FILE nạp sau.
 *   - `function` trùng tên KHÔNG báo lỗi, file nạp SAU lặng lẽ thắng.
 * Nên khi thêm định nghĩa vào đây thì phải XOÁ bản cũ ở nơi khác, không để lại.
 *
 * Selector của trang CHI TIẾT job vẫn nằm ở job-extractor.js — đây chỉ lo DANH SÁCH.
 */

/** Trần thời gian chờ LinkedIn dựng danh sách (ms). */
const JH_LIST_READY_TIMEOUT_MS = 15000;

/**
 * Thẻ việc làm trong danh sách. LinkedIn đổi markup liên tục nên giữ cả biến thể
 * cũ lẫn mới. Thứ tự chỉ dùng để phá hoà khi hai selector ra cùng số lượng.
 */
const JH_JOB_CARD_SELECTORS = [
  "li[data-occludable-job-id]",
  ".scaffold-layout__list-item",
  ".jobs-search-results-list__list-item",
  ".jobs-search-results__list-item",
  ".job-card-job-posting-card-wrapper",
  ".job-card-container",
  ".base-search-card",
  ".discovery-templates-entity-item",
  "[data-occludable-job-id]",
  "[data-job-id]",
  "[data-view-name='job-card']",
];

/**
 * Các selector đủ chung để khớp nhầm thứ không phải thẻ. Nếu một selector trong
 * nhóm này chỉ ra 1 phần tử trong khi có selector cụ thể khác ra kết quả, bỏ nó.
 */
const JH_GENERIC_CARD_SELECTORS = new Set([
  "[data-occludable-job-id]",
  "[data-job-id]",
  "[data-view-name='job-card']",
  ".discovery-templates-entity-item",
]);

/** Phần tử bấm được bên trong một thẻ, thử lần lượt từ cụ thể tới chung. */
const JH_CARD_CLICK_SELECTORS = [
  "a.job-card-list__title--link",
  ".job-card-list__title",
  "a.job-card-container__link",
  ".job-card-job-posting-card-wrapper__card-link",
  ".artdeco-entity-lockup__title a",
  "a[href*='/jobs/view/']",
  ".base-search-card__title",
  "h3",
];

/** Khung cuộn chứa danh sách thẻ. */
const JH_LIST_CONTAINER_SELECTORS = [
  ".jobs-search-results-list",
  ".scaffold-layout__list-container",
  ".scaffold-layout__list",
  ".jobs-search-results__list",
  "div[data-view-name='job-search-results-list']",
];

/** Banner "không có kết quả" — mốc tin cậy để phân biệt hết job với lỗi tải. */
const JH_NO_RESULTS_SELECTORS = [
  ".jobs-search-no-results-banner",
  ".jobs-search-two-pane__no-results-banner--shown",
  "[class*='no-results-banner']",
];

/** Pane chi tiết — phải loại khỏi kết quả dò thẻ vì nó cũng mang data-job-id. */
const JH_DETAIL_PANE_SELECTORS = [
  ".jobs-search__job-details--wrapper",
  ".jobs-search__job-details",
  ".jobs-semantic-search-job-details-wrapper",
  ".jobs-details",
];

const JH_JOB_LINK_SELECTOR = "a[href*='/jobs/view/']";
const JH_JOB_ID_DESCENDANT_SELECTOR =
  "[data-occludable-job-id],[data-job-id],a[href*='/jobs/view/']";

/**
 * LinkedIn job id của một thẻ.
 *
 * Chấp nhận CẢ HAI thuộc tính: data-occludable-job-id (danh sách ảo hoá) và
 * data-job-id (markup mới). Bản cũ ở crawl-state.js chỉ nhận cái đầu, nên khi
 * LinkedIn đổi sang cái sau thì khử trùng lặp tụt xuống dùng href.
 *
 * Ràng buộc /^\d{6,}$/ là bắt buộc: vài bản dựng của LinkedIn gắn
 * data-job-id="search" lên khung bao danh sách; không chặn thì khung đó biến
 * thành "thẻ" và selector [data-job-id] phá nát toàn bộ phép dò.
 */
function jhCardJobIdFrom(card) {
  if (!card || card.nodeType !== 1) return null;

  if (card.getAttribute) {
    for (const attr of ["data-occludable-job-id", "data-job-id"]) {
      const v = card.getAttribute(attr);
      if (v && /^\d{6,}$/.test(v)) return v;
    }
    const urn = card.getAttribute("data-entity-urn");
    if (urn) {
      const m = urn.match(/jobPosting:(\d{6,})/);
      if (m) return m[1];
    }
  }

  const href =
    card.matches && card.matches(JH_JOB_LINK_SELECTOR)
      ? card.href
      : (card.querySelector && (card.querySelector(JH_JOB_LINK_SELECTOR) || {}).href) || "";

  if (href) {
    const m = String(href).match(/\/jobs\/view\/(?:[^/?#]*?-)?(\d{6,})/);
    if (m) return m[1];
  }

  return null;
}

/** Phần tử nằm trong (hoặc bao trùm) pane chi tiết -> không phải thẻ danh sách. */
function jhIsInsideDetailPane(el) {
  for (const sel of JH_DETAIL_PANE_SELECTORS) {
    const pane = document.querySelector(sel);
    if (pane && (pane === el || pane.contains(el) || el.contains(pane))) return true;
  }
  return false;
}

/** Số job id KHÁC NHAU nằm bên trong một phần tử (chặn trên để khỏi tốn). */
function jhDistinctJobIdsWithin(el) {
  const ids = new Set();
  if (!el.querySelectorAll) return ids;
  const nodes = Array.from(el.querySelectorAll(JH_JOB_ID_DESCENDANT_SELECTOR)).slice(0, 50);
  for (const n of nodes) {
    const id = jhCardJobIdFrom(n);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Có phải MỘT thẻ việc làm không.
 *
 * Điều kiện cuối là then chốt: phần tử chứa từ 2 job id trở lên là khung bao
 * (thẻ <ul> của cả danh sách), không phải một thẻ. Không có luật này thì một
 * selector chung khớp trúng <ul> sẽ được tính là "1 thẻ" và thắng luôn.
 */
function jhIsPlausibleJobCard(el) {
  if (!el || el.nodeType !== 1 || !el.isConnected) return false;
  if (jhIsInsideDetailPane(el)) return false;
  if (!jhCardJobIdFrom(el)) return false;
  return jhDistinctJobIdsWithin(el).size <= 1;
}

/** Bỏ trùng, bỏ phần tử lồng nhau, giữ phần tử ngoài cùng của mỗi job id. */
function jhNormalizeCardSet(list) {
  const byId = new Map();
  const noId = [];

  for (const el of list) {
    const id = jhCardJobIdFrom(el);
    if (!id) {
      noId.push(el);
      continue;
    }
    const prev = byId.get(id);
    // Giữ phần tử BAO NGOÀI: click vào thẻ ngoài an toàn hơn click vào con.
    if (!prev) byId.set(id, el);
    else if (el.contains(prev)) byId.set(id, el);
  }

  return [...byId.values(), ...noId].sort((a, b) => {
    const rel = a.compareDocumentPosition(b);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

/** Kết quả từng selector — dùng cho cả phép chọn lẫn phần chẩn đoán. */
function jhScanJobCardSelectors() {
  return JH_JOB_CARD_SELECTORS.map((selector) => {
    let raw = 0;
    let cards = [];
    try {
      const found = Array.from(document.querySelectorAll(selector));
      raw = found.length;
      cards = found.filter(jhIsPlausibleJobCard);
    } catch (e) {
      // Selector không được trình duyệt này hỗ trợ -> bỏ qua, không giết cả lượt quét
    }
    return { selector, raw, cards };
  });
}

/**
 * Phương án cuối, KHÔNG phụ thuộc tên lớp: lần ngược từ link /jobs/view/ lên
 * phần tử bao gần nhất. Cứu được trường hợp LinkedIn đổi sạch tên lớp.
 */
function jhFallbackJobCardsFromLinks() {
  const out = [];
  const anchors = Array.from(document.querySelectorAll(JH_JOB_LINK_SELECTOR));

  for (const a of anchors) {
    let node = a;
    let picked = null;
    for (let hop = 0; hop < 6 && node && node.parentElement; hop++) {
      node = node.parentElement;
      if (node.matches && node.matches("li, [role='listitem'], article")) {
        picked = node;
        break;
      }
    }
    const candidate = picked || a.closest("li") || a.parentElement || a;
    if (jhIsPlausibleJobCard(candidate)) out.push(candidate);
  }

  return jhNormalizeCardSet(out);
}

/** Bộ nhớ đệm ngắn: passive harvester quét lại mỗi lần DOM đột biến. */
let jhCardScanCache = { at: 0, cards: [] };
const JH_CARD_SCAN_TTL_MS = 200;

/**
 * Danh sách thẻ việc làm — trả về bộ TỐT NHẤT thay vì bộ khớp đầu tiên.
 *
 * Cách cũ ("khớp đầu tiên không rỗng thì thắng") rất giòn: một selector cũ còn
 * khớp đúng MỘT phần tử sai sẽ che mất selector đúng đứng sau nó.
 */
function jhGetJobCardElements() {
  const now = Date.now();
  if (now - jhCardScanCache.at < JH_CARD_SCAN_TTL_MS) {
    const live = jhCardScanCache.cards.filter((el) => el.isConnected);
    if (live.length > 0) return live;
  }

  const scan = jhScanJobCardSelectors();
  const anySpecific = scan.some(
    (e) => e.cards.length > 0 && !JH_GENERIC_CARD_SELECTORS.has(e.selector)
  );

  let best = null;
  for (const entry of scan) {
    if (entry.cards.length === 0) continue;
    // Selector chung chỉ khớp 1 phần tử trong khi đã có selector cụ thể -> nghi ngờ
    if (JH_GENERIC_CARD_SELECTORS.has(entry.selector) && entry.cards.length < 2 && anySpecific) {
      continue;
    }
    if (!best || entry.cards.length > best.cards.length) best = entry;
  }

  const cards = best ? jhNormalizeCardSet(best.cards) : jhFallbackJobCardsFromLinks();
  jhCardScanCache = { at: now, cards };
  return cards;
}

/** Khung cuộn của danh sách, null nếu trang không có. */
function jhGetListContainer() {
  for (const sel of JH_LIST_CONTAINER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/** LinkedIn đang báo "không có kết quả nào"? */
function jhHasNoResultsBanner() {
  return JH_NO_RESULTS_SELECTORS.some((sel) => !!document.querySelector(sel));
}

/** Trang hiện tại có phải loại trang CÓ danh sách việc làm không. */
function jhIsJobsSearchPath(href) {
  try {
    const p = new URL(href || location.href).pathname.replace(/\/+$/, "");
    return /^\/jobs\/(search|search-results|collections)/.test(p);
  } catch (e) {
    return false;
  }
}

/**
 * Chờ LinkedIn dựng xong danh sách. Dùng lại jhWaitFor của lib/text.js,
 * KHÔNG viết poller mới.
 *
 * shouldAbort để nút Dừng còn tác dụng: thiếu nó thì bấm Dừng giữa lúc chờ sẽ
 * treo giao diện tới hết thời gian chờ.
 */
async function jhWaitForJobCards(timeoutMs, shouldAbort) {
  const started = Date.now();
  const limit = timeoutMs || JH_LIST_READY_TIMEOUT_MS;

  await jhWaitFor(
    () =>
      (shouldAbort && shouldAbort()) ||
      jhGetJobCardElements().length > 0 ||
      jhHasNoResultsBanner(),
    limit
  );

  const cards = jhGetJobCardElements();
  return {
    ok: cards.length > 0,
    cards: cards.length,
    banner: jhHasNoResultsBanner(),
    waitedMs: Date.now() - started,
    aborted: !!(shouldAbort && shouldAbort()),
  };
}

/**
 * Chẩn đoán vì sao không dò được thẻ. Gọi được trực tiếp từ Console.
 * jobViewAnchors là chỉ dấu quan trọng nhất: bằng 0 trong khi mắt vẫn thấy job
 * nghĩa là danh sách nằm trong shadow DOM hoặc iframe, ngoài tầm với hiện tại.
 */
function jhDiagnoseJobList(extra) {
  const scan = jhScanJobCardSelectors();
  const matched = scan.filter((e) => e.cards.length > 0);
  const container = jhGetListContainer();
  const anchors = document.querySelectorAll(JH_JOB_LINK_SELECTOR).length;

  return Object.assign(
    {
      href: location.href,
      readyState: document.readyState,
      isSearchPath: jhIsJobsSearchPath(location.href),
      selectors: scan.map((e) => ({ sel: e.selector, raw: e.raw, ok: e.cards.length })),
      matchedCount: matched.length,
      totalSelectors: JH_JOB_CARD_SELECTORS.length,
      chosenSelector: matched.length ? matched[0].selector : null,
      cardCount: jhGetJobCardElements().length,
      containerFound: !!container,
      jobViewAnchors: anchors,
      noResultsBanner: jhHasNoResultsBanner(),
    },
    extra || {}
  );
}

/** Một câu ngắn nhét vừa toast. */
function jhDescribeListDiagnostic(diag) {
  const bits = [
    `${diag.matchedCount}/${diag.totalSelectors} selector khớp`,
    `khung danh sách: ${diag.containerFound ? "có" : "không thấy"}`,
    `link việc làm: ${diag.jobViewAnchors}`,
  ];
  if (diag.waitedMs) bits.push(`đã chờ ${Math.round(diag.waitedMs / 1000)}s`);
  return `Không tìm thấy danh sách thẻ việc làm (${bits.join(", ")}).`;
}

/**
 * Ghi chẩn đoán ra console trang VÀ gửi về background.
 * Console trang bị xoá sạch sau mỗi lần chuyển trang, console service worker thì không.
 */
function jhLogListDiagnostic(diag) {
  console.warn("[JobHunter] chẩn đoán danh sách việc làm", diag);
  try {
    chrome.runtime.sendMessage({ action: "CRAWL_DIAGNOSTIC", diag }, () => {
      void chrome.runtime.lastError;
    });
  } catch (e) {}
}
