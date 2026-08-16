/**
 * Controller cho giao diện Popup của Extension
 * Đọc và ghi Server URL động từ Storage, loại bỏ hoàn toàn hardcode.
 */

const DEFAULT_BACKEND_URL = "http://localhost:3000";
let activeJobData = null;
let currentServerUrl = DEFAULT_BACKEND_URL;

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const emptyState = document.getElementById("emptyState");
  const jobPreview = document.getElementById("jobPreview");
  const jobLogoImg = document.getElementById("jobLogoImg");
  const jobLogoFallback = document.getElementById("jobLogoFallback");
  const jobTitle = document.getElementById("jobTitle");
  const jobCompany = document.getElementById("jobCompany");
  const jobMeta = document.getElementById("jobMeta");
  const inputServerUrl = document.getElementById("inputServerUrl");
  const btnSaveServerUrl = document.getElementById("btnSaveServerUrl");
  const btnSyncCurrent = document.getElementById("btnSyncCurrent");
  const btnScanAll = document.getElementById("btnScanAll");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");
  const alertBox = document.getElementById("alertBox");

  function showAlert(message, type = "success") {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = "block";
  }

  function hideAlert() {
    alertBox.style.display = "none";
  }

  // 1. Đọc Server URL động từ Chrome Storage
  chrome.storage.local.get(["serverUrl"], (res) => {
    currentServerUrl = res.serverUrl || DEFAULT_BACKEND_URL;
    if (inputServerUrl) {
      inputServerUrl.value = currentServerUrl;
    }
    checkServerHealth(currentServerUrl);
  });

  // 2. Lưu Server URL khi người dùng thay đổi
  btnSaveServerUrl?.addEventListener("click", () => {
    const newUrl = inputServerUrl.value.trim().replace(/\/+$/, "");
    if (!newUrl) return;
    currentServerUrl = newUrl;
    chrome.storage.local.set({ serverUrl: newUrl }, () => {
      showAlert(`Đã lưu cấu hình máy chủ: ${newUrl}`, "success");
      checkServerHealth(newUrl);
    });
  });

  function checkServerHealth(url) {
    chrome.runtime.sendMessage(
      {
        action: "SYNC_JOB_TO_BACKEND",
        serverUrl: url,
        payload: { job: { rawTitle: "PING_TEST", rawCompany: "HEALTH_CHECK" } },
      },
      (response) => {
        if (response && response.success) {
          statusBadge.className = "status-badge";
          statusDot.className = "status-dot";
          statusText.textContent = "Máy chủ Sẵn sàng";
        } else {
          statusBadge.className = "status-badge offline";
          statusDot.className = "status-dot offline";
          statusText.textContent = "Chưa kết nối máy chủ";
        }
      }
    );
  }

  // 3. Lấy thông tin từ Tab LinkedIn hiện tại
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
      emptyState.innerHTML = `
        <div style="margin-bottom:8px;">Hãy mở một trang việc làm trên LinkedIn để trích xuất.</div>
        <button id="btnGoLinkedIn" style="background:#4F46E5; color:#FFF; border:none; padding:6px 12px; border-radius:4px; font-weight:600; cursor:pointer; font-size:11px;">Mở LinkedIn Jobs</button>
      `;
      document.getElementById("btnGoLinkedIn")?.addEventListener("click", () => {
        chrome.tabs.create({ url: "https://www.linkedin.com/jobs" });
      });
    } else {
      chrome.tabs.sendMessage(tab.id, { action: "GET_ACTIVE_JOB" }, (response) => {
        if (!chrome.runtime.lastError && response && response.success && response.data) {
          activeJobData = response.data;
          emptyState.style.display = "none";
          jobPreview.style.display = "flex";

          jobTitle.textContent = activeJobData.rawTitle || "Việc làm";
          jobCompany.textContent = activeJobData.rawCompany || "Doanh nghiệp";
          jobMeta.textContent = activeJobData.rawBadges?.join(" | ") || activeJobData.pageUrl || "";

          if (activeJobData.companyLogo) {
            jobLogoImg.src = activeJobData.companyLogo;
            jobLogoImg.style.display = "block";
            jobLogoFallback.style.display = "none";
          } else {
            jobLogoFallback.textContent = activeJobData.rawCompany ? activeJobData.rawCompany.substring(0, 2).toUpperCase() : "JH";
            jobLogoFallback.style.display = "flex";
            jobLogoImg.style.display = "none";
          }
        } else {
          emptyState.textContent = "Sẵn sàng thu thập! Bấm nút bên dưới để gửi dữ liệu thô về máy chủ ánh xạ.";
        }
      });
    }
  } catch (e) {
    emptyState.textContent = "Sẵn sàng đồng bộ dữ liệu.";
  }

  // 4. Xử lý đồng bộ công việc hiện tại
  btnSyncCurrent.addEventListener("click", async () => {
    btnSyncCurrent.disabled = true;
    btnSyncCurrent.textContent = "Đang gửi dữ liệu thô...";
    hideAlert();

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!activeJobData && tab) {
        try {
          const res = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "GET_ACTIVE_JOB" }, resolve);
          });
          if (res && res.success) {
            activeJobData = res.data;
          }
        } catch (err) {}
      }

      const rawPayload = activeJobData || {
        rawTitle: tab?.title || "Vị trí Chuyên viên",
        rawCompany: "Doanh nghiệp LinkedIn",
        pageUrl: tab?.url || "https://www.linkedin.com/jobs",
        rawContent: "Dữ liệu được trích xuất từ tab hiện tại.",
      };

      chrome.runtime.sendMessage(
        {
          action: "SYNC_JOB_TO_BACKEND",
          serverUrl: currentServerUrl,
          payload: { job: rawPayload },
        },
        (response) => {
          btnSyncCurrent.disabled = false;
          btnSyncCurrent.textContent = "Đồng bộ công việc này vào Dashboard";

          if (response && response.success && response.data && response.data.success) {
            const mapped = response.data.data?.[0];
            const score = mapped?.scoreResult?.totalScore || 0;
            showAlert(`Ánh xạ thành công: ${mapped?.title || "Việc làm"} (${mapped?.company}). Điểm tương thích CV: ${score}%`, "success");
          } else {
            const errMsg = response?.data?.message || response?.error || "Lỗi khi nhập công việc";
            showAlert(errMsg, "error");
          }
        }
      );
    } catch (err) {
      btnSyncCurrent.disabled = false;
      btnSyncCurrent.textContent = "Đồng bộ công việc này vào Dashboard";
      showAlert("Lỗi khi kết nối với máy chủ.", "error");
    }
  });

  // 5. Xử lý quét hàng loạt việc làm trên trang
  btnScanAll.addEventListener("click", async () => {
    btnScanAll.disabled = true;
    btnScanAll.textContent = "Đang quét danh sách thô...";
    hideAlert();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "GET_ALL_PAGE_JOBS" }, (response) => {
        if (!response || !response.success || !response.data || response.data.length === 0) {
          showAlert("Không tìm thấy danh sách thẻ công việc trên trang này.", "error");
          btnScanAll.disabled = false;
          btnScanAll.textContent = "Quét tất cả việc làm trên trang";
          return;
        }

        chrome.runtime.sendMessage(
          {
            action: "SYNC_JOB_TO_BACKEND",
            serverUrl: currentServerUrl,
            payload: { jobs: response.data },
          },
          (bgRes) => {
            btnScanAll.disabled = false;
            btnScanAll.textContent = "Quét tất cả việc làm trên trang";

            if (bgRes && bgRes.success && bgRes.data && bgRes.data.success) {
              showAlert(`Đã thu thập & ánh xạ thành công ${response.data.length} việc làm vào Dashboard!`, "success");
            } else {
              const errMsg = bgRes?.data?.message || bgRes?.error || "Lỗi khi xử lý danh sách việc làm";
              showAlert(errMsg, "error");
            }
          }
        );
      });
    } catch (err) {
      showAlert("Lỗi khi thao tác trên tab hiện tại.", "error");
      btnScanAll.disabled = false;
      btnScanAll.textContent = "Quét tất cả việc làm trên trang";
    }
  });

  // 6. Mở Dashboard
  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: currentServerUrl });
  });
});
