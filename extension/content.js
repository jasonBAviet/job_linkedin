/**
 * LinkedIn Job Extractor - Content Script (V2.0.0 - Two-Stage Ingestion Pipeline)
 * Giai đoạn 1: Quét và thu gom TOÀN BỘ dữ liệu thô hiển thị trên trang (Raw Dump)
 * Gửi nguyên vẹn về máy chủ Next.js để Giai đoạn 2 (JobMappingService) thực hiện ánh xạ và đánh giá.
 */

/**
 * Thu gom dữ liệu thô toàn diện của tin tuyển dụng đang mở trên màn hình
 */
function extractRawActiveJob() {
  // 1. Quét Tiêu đề thô từ các vị trí tiêu đề
  const titleSelectors = [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    ".jobs-details__main-content h1",
    "h1.t-24",
    ".jobs-search__job-details h1",
    "h1",
    "h2.t-24",
  ];
  let rawTitle = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 0) {
      rawTitle = el.innerText.trim();
      break;
    }
  }

  // 2. Quét Tên công ty thô
  const companySelectors = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__primary-description a",
    "a[href*='/company/']",
    ".jobs-unified-top-card__subtitle-primary-grouping a",
  ];
  let rawCompany = "";
  for (const sel of companySelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 0) {
      rawCompany = el.innerText.trim();
      break;
    }
  }

  // 3. Quét Logo công ty
  const logoSelectors = [
    ".job-details-jobs-unified-top-card__company-logo img",
    ".jobs-unified-top-card__company-logo img",
    ".ivm-view-attr__img--centered",
    ".evi-image",
    "img[alt*='logo' i]",
    "img[src*='media.licdn.com/dms/image']",
  ];
  let companyLogo = "";
  for (const sel of logoSelectors) {
    const el = document.querySelector(sel);
    if (el && (el.src || el.getAttribute("src"))) {
      companyLogo = el.src || el.getAttribute("src") || "";
      break;
    }
  }

  // 4. Quét Toàn bộ các Huy hiệu và Thông tin phụ (Badges, Insights, Bullets)
  const badgeElements = document.querySelectorAll(
    ".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .ui-label, .artdeco-pill, .job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet"
  );
  const rawBadges = Array.from(badgeElements)
    .map((el) => el.innerText.trim())
    .filter((txt) => txt.length > 0);

  // 5. Quét TOÀN BỘ nội dung văn bản (Full Raw Content) của vùng hiển thị JD
  const containerSelectors = [
    "#job-details",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-search__job-details",
    "article",
    "main",
  ];
  let rawContent = "";
  for (const sel of containerSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 50) {
      rawContent = el.innerText.trim();
      break;
    }
  }

  // Nếu không tìm thấy vùng riêng biệt, lấy toàn bộ văn bản của trang
  if (!rawContent || rawContent.length < 50) {
    rawContent = document.body ? document.body.innerText.substring(0, 12000) : "";
  }

  let linkedinUrl = window.location.href;
  const canonicalLink = document.querySelector("link[rel='canonical']");
  if (canonicalLink && canonicalLink.href) {
    linkedinUrl = canonicalLink.href;
  }

  return {
    rawTitle: rawTitle || document.title,
    rawCompany: rawCompany || "Doanh nghiệp",
    companyLogo: companyLogo || "",
    rawContent,
    rawBadges,
    pageUrl: linkedinUrl,
    pageTitle: document.title,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Thu gom TOÀN BỘ các thẻ công việc hiển thị trên danh sách tìm kiếm
 */
function extractRawAllPageCards() {
  const cardElements = document.querySelectorAll(
    ".scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container, .base-search-card, a[href*='/jobs/view/']"
  );

  const rawCards = [];
  cardElements.forEach((card, idx) => {
    const cardText = card.innerText.trim();
    if (cardText.length < 15) return;

    const titleEl = card.querySelector(".job-card-list__title, .job-card-container__link, .base-search-card__title, h3, h4");
    const compEl = card.querySelector(".job-card-container__primary-description, .job-card-container__company-name, .base-search-card__subtitle, a[href*='/company/']");
    const linkEl = card.querySelector("a.job-card-container__link, a.job-card-list__title, a.base-card__full-link, a[href*='/jobs/view/']");
    const imgEl = card.querySelector("img");

    const badges = Array.from(card.querySelectorAll(".job-card-container__metadata-item, .job-search-card__location, .badge"))
      .map((b) => b.innerText.trim());

    rawCards.push({
      id: `raw-card-${Date.now()}-${idx}`,
      rawTitle: titleEl ? titleEl.innerText.trim() : "",
      rawCompany: compEl ? compEl.innerText.trim() : "",
      companyLogo: imgEl ? imgEl.src : "",
      rawContent: cardText,
      rawBadges: badges,
      pageUrl: linkEl ? linkEl.href : window.location.href,
      pageTitle: document.title,
    });
  });

  return rawCards;
}

/**
 * Tiêm Nút Nổi trực tiếp trên trang LinkedIn
 */
function injectFloatingButton() {
  if (document.getElementById("job-hunter-floating-widget")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "job-hunter-floating-widget";
  container.style.cssText = `
    position: fixed !important;
    bottom: 28px !important;
    right: 28px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    gap: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `;

  const toast = document.createElement("div");
  toast.id = "job-hunter-toast";
  toast.style.cssText = `
    display: none;
    background-color: #0F172A !important;
    color: #FFFFFF !important;
    padding: 10px 14px !important;
    border-radius: 8px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
    max-width: 340px !important;
    line-height: 1.4 !important;
    border: 1px solid #38BDF8 !important;
  `;

  const btn = document.createElement("button");
  btn.id = "job-hunter-btn-sync";
  btn.innerHTML = `
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10B981; margin-right:8px; box-shadow: 0 0 8px #10B981;"></span>
    <span style="font-weight:700; font-size:13px; letter-spacing:0.3px;">Đồng bộ về Job Hunter</span>
  `;
  btn.style.cssText = `
    background: linear-gradient(135deg, #4F46E5 0%, #312E81 100%) !important;
    color: #FFFFFF !important;
    border: 2px solid #818CF8 !important;
    border-radius: 9999px !important;
    padding: 12px 20px !important;
    cursor: pointer !important;
    box-shadow: 0 10px 25px rgba(79, 70, 229, 0.6) !important;
    display: flex !important;
    align-items: center !important;
    transition: all 0.2s ease !important;
  `;

  btn.onmouseover = () => {
    btn.style.transform = "scale(1.04)";
  };
  btn.onmouseout = () => {
    btn.style.transform = "scale(1.0)";
  };

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Giai đoạn 1: Quét toàn bộ dữ liệu thô trên trang
    const rawJobPayload = extractRawActiveJob();
    btn.innerText = "Đang truyền tải dữ liệu thô...";
    btn.style.opacity = "0.7";

    // Gửi qua Background Worker để vượt CSP
    chrome.runtime.sendMessage(
      {
        action: "SYNC_JOB_TO_BACKEND",
        payload: { job: rawJobPayload },
      },
      (response) => {
        btn.innerHTML = `
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10B981; margin-right:8px; box-shadow: 0 0 8px #10B981;"></span>
          <span style="font-weight:700; font-size:13px; letter-spacing:0.3px;">Đồng bộ về Job Hunter</span>
        `;
        btn.style.opacity = "1";

        if (response && response.success && response.data && response.data.success) {
          const score = response.data.data?.[0]?.scoreResult?.totalScore || 0;
          const mappedTitle = response.data.data?.[0]?.title || "Việc làm";
          showToast(`Đã thu thập & ánh xạ thành công: ${mappedTitle}. Điểm phù hợp CV: ${score}%. Mở http://localhost:3000 để xem.`, "#10B981");
        } else {
          const errMsg = response?.data?.message || response?.error || "Lỗi khi truyền dữ liệu về Dashboard.";
          showToast(errMsg, "#EF4444");
        }
      }
    );
  };

  function showToast(msg, color) {
    toast.innerText = msg;
    toast.style.borderColor = color;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 6000);
  }

  container.appendChild(toast);
  container.appendChild(btn);

  const targetRoot = document.body || document.documentElement;
  if (targetRoot) {
    targetRoot.appendChild(container);
  }
}

try {
  injectFloatingButton();
} catch (e) {}

setInterval(() => {
  if (!document.getElementById("job-hunter-floating-widget")) {
    injectFloatingButton();
  }
}, 1500);

// Lắng nghe yêu cầu từ Popup Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ACTIVE_JOB") {
    const rawJob = extractRawActiveJob();
    sendResponse({ success: true, data: rawJob });
  } else if (request.action === "GET_ALL_PAGE_JOBS") {
    const rawCards = extractRawAllPageCards();
    sendResponse({ success: rawCards.length > 0, data: rawCards, total: rawCards.length });
  }
  return true;
});
