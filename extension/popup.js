/**
 * Controller cho giao diện Popup Extension (V3.0.0 - Auto Crawler Control)
 */

const DEFAULT_BACKEND_URL = "http://localhost:3000";
let activeJobData = null;
let currentServerUrl = DEFAULT_BACKEND_URL;
let isCrawlerActive = false;
// Mặc định TẮT, khớp với ngữ nghĩa opt-in ở background: nếu khởi tạo là `true`
// thì popup nháy "ĐANG BẬT" một nhịp trước khi syncCrawlerStatus() sửa lại.
let isPassiveEnabled = false;
let isAutoOpenEnabled = false;

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const emptyState = document.getElementById("emptyState");
  const jobPreview = document.getElementById("jobPreview");
  const jobTitle = document.getElementById("jobTitle");
  const jobCompany = document.getElementById("jobCompany");
  const inputServerUrl = document.getElementById("inputServerUrl");
  const btnSaveServerUrl = document.getElementById("btnSaveServerUrl");
  const btnToggleAutoCrawl = document.getElementById("btnToggleAutoCrawl");
  const btnTogglePassive = document.getElementById("btnTogglePassive");
  const btnToggleAutoOpen = document.getElementById("btnToggleAutoOpen");
  const crawlerInfo = document.getElementById("crawlerInfo");
  const statPage = document.getElementById("statPage");
  const statCount = document.getElementById("statCount");
  const statPassive = document.getElementById("statPassive");
  const btnSyncCurrent = document.getElementById("btnSyncCurrent");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");
  const alertBox = document.getElementById("alertBox");

  function showAlert(message, type = "success") {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = "block";
  }

  function hideAlert() {
    if (alertBox) alertBox.style.display = "none";
  }

  // 1. Đọc Server URL động
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["serverUrl"], (res) => {
      currentServerUrl = res.serverUrl || DEFAULT_BACKEND_URL;
      if (inputServerUrl) inputServerUrl.value = currentServerUrl;
      checkServerHealth(currentServerUrl);
    });
  } else {
    checkServerHealth(DEFAULT_BACKEND_URL);
  }

  // 2. Lưu Server URL
  btnSaveServerUrl?.addEventListener("click", () => {
    const newUrl = inputServerUrl.value.trim().replace(/\/+$/, "");
    if (!newUrl) return;
    currentServerUrl = newUrl;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl: newUrl }, () => {
        showAlert(`Đã lưu cấu hình máy chủ: ${newUrl}`, "success");
        checkServerHealth(newUrl);
      });
    }
  });

  function checkServerHealth(url) {
    // Dùng /api/health thay cho /api/jobs/import: kiểm tra kết nối KHÔNG được
    // ghi bản ghi việc làm rác vào kho dữ liệu.
    chrome.runtime.sendMessage(
      {
        action: "CHECK_HEALTH",
        serverUrl: url,
      },
      (response) => {
        if (response && response.success) {
          if (statusBadge) statusBadge.className = "status-badge";
          if (statusDot) statusDot.className = "status-dot";
          if (statusText) statusText.textContent = "Dashboard Sẵn sàng";
        } else {
          if (statusBadge) statusBadge.className = "status-badge offline";
          if (statusDot) statusDot.className = "status-dot offline";
          if (statusText) statusText.textContent = "Chưa kết nối máy chủ";
        }
      }
    );
  }

  // 3. Lấy thông tin từ tab LinkedIn hiện tại và đồng bộ trạng thái Auto-Crawler
  let activeTabId = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      activeTabId = tabs[0].id;
      if (tabs[0].url && tabs[0].url.includes("linkedin.com")) {
        // Lấy thông tin job active
        chrome.tabs.sendMessage(activeTabId, { action: "GET_ACTIVE_JOB" }, (res) => {
          if (!chrome.runtime.lastError && res && res.success && res.data) {
            activeJobData = res.data;
            if (emptyState) emptyState.style.display = "none";
            if (jobPreview) jobPreview.style.display = "block";
            if (jobTitle) jobTitle.textContent = activeJobData.rawTitle || "Việc làm";
            if (jobCompany) jobCompany.textContent = activeJobData.rawCompany || "Doanh nghiệp";
          }
        });

      } else if (emptyState) {
        emptyState.textContent =
          "Chưa mở tab LinkedIn nào. Bấm \"Bật Cào Tự Động\" bên trên, Extension sẽ tự mở giúp bạn.";
      }
    }
  } catch (e) {}

  // Trạng thái cào đọc từ background nên KHÔNG phụ thuộc tab đang mở là gì
  syncCrawlerStatus();

  /**
   * Đọc trạng thái từ BACKGROUND chứ không hỏi content script của tab đang mở.
   *
   * Background là nguồn sự thật duy nhất cho cả ba đường kích hoạt (Dashboard,
   * popup, widget nổi) — nhờ vậy popup thấy đúng phiên cào kể cả khi bạn đang
   * đứng ở tab Dashboard hay một tab bất kỳ không phải LinkedIn.
   */
  function syncCrawlerStatus() {
    chrome.runtime.sendMessage({ action: "GET_REMOTE_STATUS" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) return;

      const state = res.payload || {};
      isCrawlerActive = !!state.isRunning;

      if (crawlerInfo) crawlerInfo.style.display = isCrawlerActive ? "flex" : "none";
      if (statPage) statPage.textContent = state.pageNumber || 1;
      if (statCount) statCount.textContent = state.crawledCount || 0;

      if (btnToggleAutoCrawl) {
        if (isCrawlerActive) {
          const from = state.origin === "DASHBOARD" ? " (từ Dashboard)" : state.origin === "WIDGET" ? " (từ LinkedIn)" : "";
          btnToggleAutoCrawl.textContent = `Dừng Cào Tự Động${from}`;
          btnToggleAutoCrawl.className = "btn btn-stop";
        } else {
          btnToggleAutoCrawl.textContent = "Bật Cào Tự Động Liên Tục";
          btnToggleAutoCrawl.className = "btn btn-auto";
        }
      }

      renderPassiveState(state.passive);
    });
  }

  function renderPassiveState(passive) {
    if (!passive) return;
    isPassiveEnabled = !!passive.enabled;
    isAutoOpenEnabled = isPassiveEnabled && !!passive.autoOpen;

    if (statPassive) statPassive.textContent = passive.savedCount || 0;
    if (btnTogglePassive) {
      btnTogglePassive.textContent = isPassiveEnabled ? "Chế độ ghi: ĐANG BẬT" : "Chế độ ghi: ĐANG TẮT";
      btnTogglePassive.className = isPassiveEnabled ? "btn btn-passive" : "btn btn-passive off";
    }
    if (btnToggleAutoOpen) {
      btnToggleAutoOpen.textContent = isAutoOpenEnabled
        ? "Tự mở JD khi cuộn: ĐANG BẬT"
        : "Tự mở JD khi cuộn: ĐANG TẮT";
      btnToggleAutoOpen.className = isAutoOpenEnabled ? "btn btn-autoopen" : "btn btn-autoopen off";
      // Tầng phụ vô nghĩa một mình: khoá lại để không ai tưởng đã bật thu thập.
      btnToggleAutoOpen.disabled = !isPassiveEnabled;
    }
  }

  // Định kỳ cập nhật tiến trình cào khi popup đang mở
  const statusInterval = setInterval(syncCrawlerStatus, 1000);
  window.addEventListener("unload", () => clearInterval(statusInterval));

  // 4. Bật/Tắt Auto-Crawler — đi qua background nên bấm được từ BẤT KỲ tab nào.
  //    Ở tab LinkedIn thì cào ngay trên tab đó; ở tab khác thì background tự mở tab LinkedIn.
  btnToggleAutoCrawl?.addEventListener("click", () => {
    btnToggleAutoCrawl.disabled = true;
    hideAlert();

    if (isCrawlerActive) {
      chrome.runtime.sendMessage({ action: "STOP_REMOTE_CRAWL" }, () => {
        btnToggleAutoCrawl.disabled = false;
        syncCrawlerStatus();
        showAlert("Đã dừng cào tự động.", "success");
      });
      return;
    }

    chrome.runtime.sendMessage(
      { action: "OPEN_LINKEDIN_AND_CRAWL", preferActiveTab: true, origin: "POPUP", filters: {} },
      (res) => {
        btnToggleAutoCrawl.disabled = false;

        if (chrome.runtime.lastError || !res) {
          showAlert("Không liên lạc được với Extension. Hãy tải lại Extension rồi thử lại.", "error");
          return;
        }

        if (!res.success) {
          showAlert(
            res.code === "ALREADY_RUNNING"
              ? "Đang có một phiên cào chạy dở. Hãy dừng phiên đó trước."
              : res.code === "RATE_LIMITED"
              ? "Bạn vừa bắt đầu một phiên cào. Chờ vài giây rồi thử lại."
              : "Không bắt đầu được phiên cào.",
            "error"
          );
          return;
        }

        syncCrawlerStatus();
        showAlert(
          res.payload && res.payload.reusedTab
            ? "Đã kích hoạt cào tự động trên tab LinkedIn hiện tại."
            : "Đã mở tab LinkedIn mới và bắt đầu cào tự động.",
          "success"
        );
      }
    );
  });

  // 4b. Bật/Tắt chế độ ghi (áp dụng cho MỌI tab LinkedIn đang mở)
  btnTogglePassive?.addEventListener("click", () => {
    const next = !isPassiveEnabled;
    btnTogglePassive.disabled = true;

    // Tắt thì hạ luôn tầng phụ: bật lại lần sau phải là một quyết định mới.
    chrome.runtime.sendMessage(
      { action: "SET_PASSIVE_ENABLED", enabled: next, autoOpen: next ? isAutoOpenEnabled : false },
      (res) => {
        btnTogglePassive.disabled = false;
        if (chrome.runtime.lastError || !res || !res.success) {
          showAlert("Không đổi được chế độ ghi.", "error");
          return;
        }
        renderPassiveState(res.payload);
        showAlert(
          next
            ? "Đã bật chế độ ghi. Việc làm bạn tự bấm mở sẽ chảy về Dashboard."
            : "Đã tắt chế độ ghi.",
          "success"
        );
      }
    );
  });

  // 4c. Bật/Tắt riêng tầng tự mở JD khi cuộn
  btnToggleAutoOpen?.addEventListener("click", () => {
    if (!isPassiveEnabled) return;
    const next = !isAutoOpenEnabled;
    btnToggleAutoOpen.disabled = true;

    chrome.runtime.sendMessage({ action: "SET_AUTO_OPEN_ENABLED", autoOpen: next }, (res) => {
      btnToggleAutoOpen.disabled = false;
      if (chrome.runtime.lastError || !res || !res.success) {
        showAlert(
          res && res.code === "RECORD_OFF"
            ? "Hãy bật Chế độ ghi trước."
            : "Không đổi được tuỳ chọn tự mở JD.",
          "error"
        );
        if (res && res.payload) renderPassiveState(res.payload);
        return;
      }
      renderPassiveState(res.payload);
      showAlert(
        next
          ? "Đã bật tự mở JD. Thẻ nào dừng trong tầm nhìn sẽ được mở và lưu."
          : "Đã tắt tự mở JD. Chỉ còn lưu việc làm bạn tự bấm mở.",
        "success"
      );
    });
  });

  // 5. Đồng bộ 1 việc làm hiện tại
  btnSyncCurrent?.addEventListener("click", async () => {
    if (!activeTabId) return;
    btnSyncCurrent.disabled = true;
    btnSyncCurrent.textContent = "Đang đồng bộ...";
    hideAlert();

    // Không bóc tách được thì BÁO LỖI, tuyệt đối không dựng dữ liệu giả để gửi đi.
    if (!activeJobData || !activeJobData.extractOk) {
      btnSyncCurrent.disabled = false;
      btnSyncCurrent.textContent = "Đồng bộ chỉ 1 việc làm này";
      const thieu = (activeJobData?.missingFields || []).join(", ") || "toàn bộ nội dung";
      showAlert(
        `Không đọc được tin tuyển dụng trên trang này (thiếu: ${thieu}). Hãy mở một trang chi tiết việc làm rồi thử lại.`,
        "error"
      );
      return;
    }

    const rawPayload = activeJobData;

    chrome.runtime.sendMessage(
      {
        action: "SYNC_JOB_TO_BACKEND",
        serverUrl: currentServerUrl,
        payload: { job: rawPayload },
      },
      (res) => {
        btnSyncCurrent.disabled = false;
        btnSyncCurrent.textContent = "Đồng bộ chỉ 1 việc làm này";
        if (res && res.success && res.data && res.data.success) {
          showAlert(`Đã đồng bộ thành công: ${res.data.data?.[0]?.title || "Việc làm"}`, "success");
        } else {
          showAlert(res?.error || "Lỗi khi đồng bộ về máy chủ.", "error");
        }
      }
    );
  });

  // 6. Mở Dashboard
  btnOpenDashboard?.addEventListener("click", () => {
    chrome.tabs.create({ url: currentServerUrl });
  });
});
