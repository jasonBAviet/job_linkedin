/**
 * LinkedIn Job Extractor - Content Script (V1.0.2)
 * Tự động tiêm Nút Nổi trực tiếp trên mọi trang LinkedIn và chuyển tiếp dữ liệu qua Background Worker để vượt rào cản CSP.
 */

function extractActiveJob() {
  // 1. Tiêu đề công việc
  const titleElem =
    document.querySelector(".job-details-jobs-unified-top-card__job-title") ||
    document.querySelector(".jobs-unified-top-card__job-title") ||
    document.querySelector(".jobs-details__main-content h1") ||
    document.querySelector("h1.t-24") ||
    document.querySelector(".jobs-search__job-details h1") ||
    document.querySelector("h1") ||
    document.querySelector("h2.t-24");

  let title = titleElem ? titleElem.innerText.trim() : "";
  if (!title && document.title) {
    const parts = document.title.split("|")[0].split("-")[0];
    title = parts.trim();
  }

  // 2. Tên công ty
  const companyElem =
    document.querySelector(".job-details-jobs-unified-top-card__company-name") ||
    document.querySelector(".jobs-unified-top-card__company-name") ||
    document.querySelector(".job-details-jobs-unified-top-card__primary-description a") ||
    document.querySelector("a[href*='/company/']") ||
    document.querySelector(".jobs-unified-top-card__subtitle-primary-grouping a");

  let company = companyElem ? companyElem.innerText.trim() : "";
  if (!company) {
    company = "Doanh nghiệp trên LinkedIn";
  }

  // 3. Logo công ty
  const logoElem =
    document.querySelector(".job-details-jobs-unified-top-card__company-logo img") ||
    document.querySelector(".jobs-unified-top-card__company-logo img") ||
    document.querySelector(".ivm-view-attr__img--centered") ||
    document.querySelector(".evi-image") ||
    document.querySelector("img[alt*='logo' i]");

  const companyLogo = logoElem ? logoElem.src || logoElem.getAttribute("src") : "";

  // 4. Địa điểm
  const primaryDescElem =
    document.querySelector(".job-details-jobs-unified-top-card__primary-description") ||
    document.querySelector(".jobs-unified-top-card__primary-description") ||
    document.querySelector(".job-details-jobs-unified-top-card__bullet");

  const primaryText = primaryDescElem ? primaryDescElem.innerText : document.body.innerText.substring(0, 500);

  let locationDetails = "TP. Hồ Chí Minh";
  if (primaryText.toLowerCase().includes("dong nai") || primaryText.toLowerCase().includes("đồng nai") || primaryText.toLowerCase().includes("bien hoa")) {
    locationDetails = "Đồng Nai";
  } else if (primaryText.toLowerCase().includes("ho chi minh") || primaryText.toLowerCase().includes("hồ chí minh")) {
    locationDetails = "TP. Hồ Chí Minh";
  }

  // 5. Mức lương / Chế độ làm việc
  const insights = Array.from(
    document.querySelectorAll(".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .ui-label")
  ).map((el) => el.innerText.trim());

  let salaryText = "Thỏa thuận theo năng lực";
  let workMode = "HYBRID";

  for (const insight of insights) {
    if (insight.includes("₫") || insight.includes("$") || insight.includes("/tháng") || insight.includes("/năm") || insight.includes("Triệu")) {
      salaryText = insight;
    }
    if (insight.toLowerCase().includes("on-site") || insight.toLowerCase().includes("tại văn phòng")) {
      workMode = "ON_SITE";
    } else if (insight.toLowerCase().includes("remote") || insight.toLowerCase().includes("từ xa")) {
      workMode = "REMOTE";
    }
  }

  // 6. Mô tả chi tiết công việc (JD)
  const descElem =
    document.querySelector("#job-details") ||
    document.querySelector(".jobs-description-content__text") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector(".jobs-description__content") ||
    document.querySelector("article");

  const jobDescription = descElem ? descElem.innerText.trim() : document.body.innerText.substring(0, 2000);

  // 7. Đường dẫn công việc
  let linkedinUrl = window.location.href;
  const canonicalLink = document.querySelector("link[rel='canonical']");
  if (canonicalLink && canonicalLink.href) {
    linkedinUrl = canonicalLink.href;
  }

  return {
    title: title || "Chuyên viên Phân tích (LinkedIn)",
    company,
    companyLogo: companyLogo || "",
    locationDetails,
    salaryText,
    workMode,
    jobDescription: jobDescription || "Mô tả công việc đang được cập nhật từ LinkedIn.",
    linkedinUrl,
    postedDate: new Date().toISOString().split("T")[0],
  };
}

function extractAllJobsOnPage() {
  const cards = document.querySelectorAll(
    ".scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container, .base-search-card"
  );

  const results = [];
  cards.forEach((card, idx) => {
    const titleEl = card.querySelector(".job-card-list__title, .job-card-container__link, .base-search-card__title");
    const compEl = card.querySelector(".job-card-container__primary-description, .job-card-container__company-name, .base-search-card__subtitle");
    const locEl = card.querySelector(".job-card-container__metadata-item, .job-search-card__location");
    const linkEl = card.querySelector("a.job-card-container__link, a.job-card-list__title, a.base-card__full-link");
    const imgEl = card.querySelector("img");

    const title = titleEl ? titleEl.innerText.trim() : "";
    const company = compEl ? compEl.innerText.trim() : "";
    const location = locEl ? locEl.innerText.trim() : "";
    const link = linkEl ? linkEl.href : "";
    const logo = imgEl ? imgEl.src : "";

    if (title || company) {
      results.push({
        id: `linkedin-card-${Date.now()}-${idx}`,
        title: title || "Vị trí tuyển dụng",
        company: company || "Doanh nghiệp",
        companyLogo: logo,
        locationDetails: location || "TP. Hồ Chí Minh",
        linkedinUrl: link || window.location.href,
        jobDescription: `Vị trí ${title} tại ${company}. Chi tiết xem tại: ${link}`,
        salaryText: "Thỏa thuận theo năng lực",
        workMode: "HYBRID",
        postedDate: new Date().toISOString().split("T")[0],
      });
    }
  });

  return results;
}

/**
 * Tiêm Nút Nổi vào trang LinkedIn (Floating Action Button)
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
    max-width: 320px !important;
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
    background: #4F46E5 !important;
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

    const job = extractActiveJob();
    btn.innerText = "Đang gửi qua Service Worker...";
    btn.style.opacity = "0.7";

    // Gửi qua Background Service Worker để vượt qua rào cản CSP của LinkedIn
    chrome.runtime.sendMessage(
      {
        action: "SYNC_JOB_TO_BACKEND",
        payload: { job },
      },
      (response) => {
        btn.innerHTML = `
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10B981; margin-right:8px; box-shadow: 0 0 8px #10B981;"></span>
          <span style="font-weight:700; font-size:13px; letter-spacing:0.3px;">Đồng bộ về Job Hunter</span>
        `;
        btn.style.opacity = "1";

        if (response && response.success && response.data && response.data.success) {
          const score = response.data.data?.[0]?.scoreResult?.totalScore || 0;
          showToast(`Đã đồng bộ thành công! Điểm phù hợp CV: ${score}%. Mở http://localhost:3000 để xem.`, "#10B981");
        } else {
          const errMsg = response?.data?.message || response?.error || "Lỗi khi đồng bộ dữ liệu về Dashboard.";
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

// Chạy khởi tạo ngay
try {
  injectFloatingButton();
} catch (e) {}

// Giữ nút luôn hiển thị khi người dùng cuộn hoặc chuyển tab trên LinkedIn
setInterval(() => {
  if (!document.getElementById("job-hunter-floating-widget")) {
    injectFloatingButton();
  }
}, 1500);

// Lắng nghe từ Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ACTIVE_JOB") {
    const job = extractActiveJob();
    sendResponse({ success: !!job, data: job });
  } else if (request.action === "GET_ALL_PAGE_JOBS") {
    const jobs = extractAllJobsOnPage();
    sendResponse({ success: jobs.length > 0, data: jobs, total: jobs.length });
  }
  return true;
});
