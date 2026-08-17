/**
 * LinkedIn Job Hunter - Floating UI Widget & Notification Component
 * Quản lý các phần tử giao diện nổi điều khiển bộ cào và thông báo tiến độ trên trang LinkedIn.
 */

let jhToastTimeout = null;

function jhShowProgressToast(msg, duration = 4000, borderColor = "#818CF8", onStopClick = null) {
  const toast = document.getElementById("job-hunter-toast");
  if (!toast) return;

  if (jhToastTimeout) {
    clearTimeout(jhToastTimeout);
    jhToastTimeout = null;
  }

  toast.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <span style="line-height:1.4;">${msg}</span>
      ${
        onStopClick
          ? `<button id="toast-stop-btn" style="background:#EF4444; color:#FFF; border:none; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">Dừng</button>`
          : ""
      }
    </div>
  `;
  toast.style.borderColor = borderColor;
  toast.style.display = "block";

  const stopBtn = document.getElementById("toast-stop-btn");
  if (stopBtn && onStopClick) {
    stopBtn.onclick = (e) => {
      e.preventDefault();
      onStopClick();
    };
  }

  if (!onStopClick && duration > 0) {
    jhToastTimeout = setTimeout(() => {
      toast.style.display = "none";
    }, duration);
  }
}

function jhUpdateCrawlerButton(isRunning) {
  const btnAuto = document.getElementById("job-hunter-btn-auto");
  if (btnAuto) {
    if (isRunning) {
      btnAuto.innerText = "Dừng Cào Tự Động";
      btnAuto.style.background = "#DC2626";
      btnAuto.style.borderColor = "#F87171";
    } else {
      btnAuto.innerText = "Cào Tự Động Tất Cả Trang";
      btnAuto.style.background = "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)";
      btnAuto.style.borderColor = "#A78BFA";
    }
  }
}

/**
 * Cập nhật cặp chỉ báo chế độ ghi trên widget nổi.
 *
 * Nút phụ "Tự mở JD" bị làm mờ và chặn bấm khi chế độ ghi đang tắt — nó vô
 * nghĩa một mình, và để bấm được sẽ khiến người dùng tưởng đã bật thu thập.
 */
function jhUpdatePassiveIndicator(enabled, savedCount, autoOpen) {
  const btn = document.getElementById("job-hunter-btn-passive");
  if (btn) {
    btn.innerText = enabled ? `Chế độ ghi: BẬT · ${savedCount || 0}` : "Chế độ ghi: TẮT";
    btn.style.background = enabled ? "#082F49" : "#1E293B";
    btn.style.color = enabled ? "#38BDF8" : "#94A3B8";
    btn.style.borderColor = enabled ? "#0EA5E9" : "#475569";
  }

  const btnAuto = document.getElementById("job-hunter-btn-autoopen");
  if (btnAuto) {
    btnAuto.innerText = autoOpen ? "Tự mở JD khi cuộn: BẬT" : "Tự mở JD khi cuộn: TẮT";
    btnAuto.style.background = autoOpen ? "#3B0764" : "#1E293B";
    btnAuto.style.color = autoOpen ? "#D8B4FE" : "#94A3B8";
    btnAuto.style.borderColor = autoOpen ? "#A855F7" : "#475569";
    btnAuto.style.opacity = enabled ? "1" : "0.45";
    btnAuto.style.pointerEvents = enabled ? "auto" : "none";
  }
}

function jhInjectFloatingWidget(callbacks = {}) {
  if (document.getElementById("job-hunter-floating-widget")) return;

  const container = document.createElement("div");
  container.id = "job-hunter-floating-widget";
  container.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    gap: 6px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `;

  const toast = document.createElement("div");
  toast.id = "job-hunter-toast";
  toast.style.cssText = `
    display: none;
    background-color: #0F172A !important;
    color: #FFFFFF !important;
    padding: 8px 12px !important;
    border-radius: 8px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    max-width: 380px !important;
    border: 1px solid #818CF8 !important;
  `;

  const btnAuto = document.createElement("button");
  btnAuto.id = "job-hunter-btn-auto";
  btnAuto.innerText = "Cào Tự Động Tất Cả Trang";
  btnAuto.style.cssText = `
    background: linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%) !important;
    color: #FFFFFF !important;
    border: 2px solid #A78BFA !important;
    border-radius: 9999px !important;
    padding: 10px 18px !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    cursor: pointer !important;
    box-shadow: 0 8px 20px rgba(124, 58, 237, 0.5) !important;
    transition: all 0.2s ease !important;
  `;
  btnAuto.onclick = () => {
    if (callbacks.onToggleAuto) callbacks.onToggleAuto();
  };

  const btnSync = document.createElement("button");
  btnSync.id = "job-hunter-btn-sync";
  btnSync.innerText = "Đồng bộ việc làm này";
  btnSync.style.cssText = `
    background: #0F172A !important;
    color: #38BDF8 !important;
    border: 1px solid #38BDF8 !important;
    border-radius: 9999px !important;
    padding: 6px 14px !important;
    font-weight: 600 !important;
    font-size: 11px !important;
    cursor: pointer !important;
  `;
  btnSync.onclick = () => {
    if (callbacks.onSyncActive) callbacks.onSyncActive();
  };

  const pillStyle = `
    background: #1E293B !important;
    color: #94A3B8 !important;
    border: 1px solid #475569 !important;
    border-radius: 9999px !important;
    padding: 5px 12px !important;
    font-weight: 600 !important;
    font-size: 10px !important;
    cursor: pointer !important;
  `;

  const btnPassive = document.createElement("button");
  btnPassive.id = "job-hunter-btn-passive";
  btnPassive.innerText = "Chế độ ghi: TẮT";
  btnPassive.title =
    "Bật thì việc làm bạn tự bấm mở sẽ được lưu về Dashboard. Tắt thì Extension không ghi gì cả.";
  btnPassive.style.cssText = pillStyle;
  btnPassive.onclick = () => {
    if (callbacks.onTogglePassive) callbacks.onTogglePassive();
  };

  const btnAutoOpen = document.createElement("button");
  btnAutoOpen.id = "job-hunter-btn-autoopen";
  btnAutoOpen.innerText = "Tự mở JD khi cuộn: TẮT";
  btnAutoOpen.title =
    "Chỉ có tác dụng khi Chế độ ghi đang bật. Bật thì thẻ nào dừng trong tầm nhìn sẽ được Extension tự mở rồi lưu.";
  // Không gắn !important cho hai thuộc tính này: jhUpdatePassiveIndicator ghi đè
  // chúng qua CSSOM, mà ghi đè kiểu đó không kèm được cờ !important.
  btnAutoOpen.style.cssText = `${pillStyle}
    opacity: 0.45;
    pointer-events: none;
  `;
  btnAutoOpen.onclick = () => {
    if (callbacks.onToggleAutoOpen) callbacks.onToggleAutoOpen();
  };

  container.appendChild(toast);
  container.appendChild(btnAuto);
  container.appendChild(btnSync);
  container.appendChild(btnPassive);
  container.appendChild(btnAutoOpen);
  (document.body || document.documentElement).appendChild(container);
}
