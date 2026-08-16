/**
 * Controller cho giao diện Popup của Extension
 * Chuyển tiếp toàn bộ yêu cầu qua Background Service Worker để tránh vi phạm CSP.
 */

let activeJobData = null;

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

  // 1. Kiểm tra kết nối tới máy chủ Next.js qua Background Worker
  chrome.runtime.sendMessage(
    {
      action: "SYNC_JOB_TO_BACKEND",
      payload: { job: { title: "PING_TEST", company: "TEST" } },
    },
    (response) => {
      if (response && response.success) {
        statusBadge.className = "status-badge";
        statusDot.className = "status-dot";
        statusText.textContent = "Dashboard Sẵn sàng";
      } else {
        statusBadge.className = "status-badge offline";
        statusDot.className = "status-dot offline";
        statusText.textContent = "Chưa kết nối localhost:3000";
      }
    }
  );

  // 2. Lấy thông tin từ Tab LinkedIn hiện tại
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

          jobTitle.textContent = activeJobData.title;
          jobCompany.textContent = activeJobData.company;
          jobMeta.textContent = `${activeJobData.locationDetails} | ${activeJobData.salaryText}`;

          if (activeJobData.companyLogo) {
            jobLogoImg.src = activeJobData.companyLogo;
            jobLogoImg.style.display = "block";
            jobLogoFallback.style.display = "none";
          } else {
            jobLogoFallback.textContent = activeJobData.company ? activeJobData.company.substring(0, 2).toUpperCase() : "JH";
            jobLogoFallback.style.display = "flex";
            jobLogoImg.style.display = "none";
          }
        } else {
          emptyState.textContent = "Sẵn sàng đồng bộ! Nhấp nút bên dưới để trích xuất ngay tin tuyển dụng trên màn hình.";
        }
      });
    }
  } catch (e) {
    emptyState.textContent = "Sẵn sàng đồng bộ với localhost:3000.";
  }

  // 3. Xử lý đồng bộ công việc hiện tại
  btnSyncCurrent.addEventListener("click", async () => {
    btnSyncCurrent.disabled = true;
    btnSyncCurrent.textContent = "Đang gửi dữ liệu...";
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

      const jobToSend = activeJobData || {
        title: tab?.title || "Vị trí Chuyên viên Phân tích",
        company: "Doanh nghiệp trên LinkedIn",
        linkedinUrl: tab?.url || "https://www.linkedin.com/jobs",
        jobDescription: "Dữ liệu được trích xuất từ trang LinkedIn.",
      };

      chrome.runtime.sendMessage(
        {
          action: "SYNC_JOB_TO_BACKEND",
          payload: { job: jobToSend },
        },
        (response) => {
          btnSyncCurrent.disabled = false;
          btnSyncCurrent.textContent = "Đồng bộ công việc này vào Dashboard";

          if (response && response.success && response.data && response.data.success) {
            const score = response.data.data?.[0]?.scoreResult?.totalScore || 0;
            showAlert(`Đã đồng bộ thành công vào Dashboard! Điểm tương thích CV: ${score}%`, "success");
          } else {
            const errMsg = response?.data?.message || response?.error || "Lỗi khi nhập công việc";
            showAlert(errMsg, "error");
          }
        }
      );
    } catch (err) {
      btnSyncCurrent.disabled = false;
      btnSyncCurrent.textContent = "Đồng bộ công việc này vào Dashboard";
      showAlert("Lỗi khi gửi yêu cầu qua Extension Worker.", "error");
    }
  });

  // 4. Xử lý quét hàng loạt việc làm trên trang
  btnScanAll.addEventListener("click", async () => {
    btnScanAll.disabled = true;
    btnScanAll.textContent = "Đang quét danh sách...";
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
            payload: { jobs: response.data },
          },
          (bgRes) => {
            btnScanAll.disabled = false;
            btnScanAll.textContent = "Quét tất cả việc làm trên trang";

            if (bgRes && bgRes.success && bgRes.data && bgRes.data.success) {
              showAlert(`Đã đồng bộ thành công ${response.data.length} việc làm vào Dashboard!`, "success");
            } else {
              const errMsg = bgRes?.data?.message || bgRes?.error || "Lỗi khi nhập danh sách việc làm";
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

  // 5. Mở Dashboard
  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:3000" });
  });
});
