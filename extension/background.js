/**
 * Background Service Worker cho WebExtension
 * Đọc cấu hình Server URL động từ Storage hoặc Message Payload, không hardcode cố định.
 */

const DEFAULT_BACKEND_URL = "http://localhost:3000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["serverUrl"], (res) => {
    if (!res.serverUrl) {
      chrome.storage.local.set({ serverUrl: DEFAULT_BACKEND_URL });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_JOB_TO_BACKEND") {
    // Ưu tiên Server URL truyền trong payload, sau đó là storage, cuối cùng là default
    chrome.storage.local.get(["serverUrl"], (res) => {
      const targetServerUrl = request.serverUrl || res.serverUrl || DEFAULT_BACKEND_URL;
      const endpoint = `${targetServerUrl.replace(/\/+$/, "")}/api/jobs/import`;

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.payload),
      })
        .then(async (response) => {
          const json = await response.json();
          sendResponse({ success: response.ok, data: json, targetServerUrl });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: `Không thể kết nối đến máy chủ ${targetServerUrl}. Vui lòng kiểm tra lại cấu hình hoặc đảm bảo dịch vụ đang chạy.`,
          });
        });
    });

    return true;
  }
});
