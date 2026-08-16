/**
 * Background Service Worker cho WebExtension (Chrome & Firefox)
 * Đóng vai trò Proxy chuyển tiếp HTTP Request để vượt qua rào cản Content-Security-Policy (CSP) của LinkedIn.
 */

const BACKEND_URL = "http://localhost:3000";

chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkedIn Job Hunter Extractor Service Worker khoi tao thanh cong.");
});

// Lắng nghe yêu cầu gửi dữ liệu từ Content Script và Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_JOB_TO_BACKEND") {
    fetch(`${BACKEND_URL}/api/jobs/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.payload),
    })
      .then(async (response) => {
        const json = await response.json();
        sendResponse({ success: response.ok, data: json });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: "Không thể kết nối đến máy chủ http://localhost:3000. Hãy đảm bảo dự án đang chạy npm run dev.",
        });
      });

    // Trả về true để giữ kênh kết nối bất đồng bộ cho sendResponse
    return true;
  }
});
