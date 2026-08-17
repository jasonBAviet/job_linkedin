/**
 * LinkedIn Job Extractor - Content Script (V3.2.0 - Anti-Detection & Random Delay)
 * Tự động cào đa trang với cơ chế làm trễ ngẫu nhiên (Jitter) mô phỏng người dùng thật.
 */

/**
 * Báo tiến trình cào về background để Dashboard hiển thị theo thời gian thực.
 * Bỏ qua yên lặng nếu background không phản hồi — không được làm gián đoạn vòng cào.
 */
function jhEmitCrawlProgress(crawler, phase, extra = {}) {
  try {
    chrome.runtime.sendMessage(
      {
        action: "CRAWL_PROGRESS",
        phase,
        sessionId: crawler.sessionId,
        origin: crawler.origin,
        isRunning: crawler.isRunning,
        crawledCount: crawler.crawledCount,
        pageNumber: crawler.pageNumber,
        ...extra,
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  } catch (e) {}
}

class LinkedInAutoCrawler {
  constructor() {
    this.isRunning = false;
    this.crawledCount = 0;
    this.pageNumber = 1;
    this.processedUrls = new Set();
    this.cardsSinceLastPause = 0;
    this.nextPauseThreshold = jhGetNextReadingPauseThreshold();
    this.sessionId = null;
    this.isRemote = false;
    this.origin = "WIDGET";
    /** Checkpoint của phiên đang chạy (ghi vào chrome.storage.local sau mỗi thẻ) */
    this.ckpt = null;
    /** Phiên dở dang phát hiện lúc bootstrap, chờ người dùng bấm để tiếp tục */
    this.pendingResume = null;
  }

  async scrollListContainer() {
    const container = jhGetListContainer();

    const steps = jhRandomBetween(3, 5);
    if (container) {
      for (let i = 1; i <= steps; i++) {
        container.scrollTop = (container.scrollHeight / steps) * i;
        await jhSleepRandom(
          JH_ANTI_DETECTION_CONFIG.SCROLL_STEP_DELAY_MIN,
          JH_ANTI_DETECTION_CONFIG.SCROLL_STEP_DELAY_MAX
        );
      }
      container.scrollTop = 0;
      await jhSleepRandom(250, 450);
    } else {
      const scrollAmount = jhRandomBetween(450, 650);
      window.scrollBy({ top: scrollAmount, behavior: "smooth" });
      await jhSleepRandom(300, 500);
      window.scrollBy({ top: -scrollAmount, behavior: "smooth" });
    }
  }

  getJobCards() {
    return jhGetJobCardElements();
  }

  async start(options = {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    jhClearStopRequest();
    this.cardsSinceLastPause = 0;
    this.nextPauseThreshold = jhGetNextReadingPauseThreshold();
    this.sessionId = options.sessionId || null;
    this.isRemote = !!options.remote;
    this.origin = options.origin || (options.remote ? "DASHBOARD" : "WIDGET");

    // Tiếp tục phiên dở dang hay bắt đầu mới
    if (options.checkpoint) {
      this.ckpt = options.checkpoint;
      this.ckpt.status = "RUNNING";
      this.crawledCount = this.ckpt.savedCount || 0;
      this.pageNumber = (this.ckpt.pageIndex || 0) + 1;
      this.processedUrls = new Set(this.ckpt.seen || []);
    } else {
      this.ckpt = jhCkptNew(location.href);
      this.crawledCount = 0;
      this.pageNumber = (this.ckpt.pageIndex || 0) + 1;
      this.processedUrls.clear();
    }
    await jhCkptSave(this.ckpt);

    // Bộ cào tự động tự click từng thẻ — phải ngưng bộ thu thập theo cuộn
    // để hai bên không giẫm chân nhau.
    jhPassiveHarvester.suspend();

    jhUpdateCrawlerButton(true);
    jhShowProgressToast(`Bắt đầu cào tự động (Random Delay): Trang ${this.pageNumber}...`, 4000, "#818CF8", () => this.stop());
    jhEmitCrawlProgress(this, "start");

    // Chờ danh sách render TRƯỚC khi quét. Đặt ở đây vì cả bốn đường vào
    // (nút widget, popup, dashboard, resume) đều đi qua start() — vá một chỗ
    // là phủ hết, thay vì nhân bản vòng chờ ra từng nhánh.
    if (!(await this.ensureJobListReady())) return;

    await this.processCurrentPage();
  }

  /**
   * Bảo đảm danh sách đã có thẻ trước khi kết luận.
   *
   * content script chạy ở document_end, tức TRƯỚC khi LinkedIn dựng danh sách ảo
   * hoá. Không chờ thì quét vào lúc DOM còn rỗng và báo nhầm "không tìm thấy".
   * Trả về false nghĩa là đã dừng (có báo lý do) hoặc người dùng bấm Dừng.
   */
  async ensureJobListReady() {
    if (jhGetJobCardElements().length > 0) return true; // đã sẵn sàng, không tốn tick nào

    jhShowProgressToast(
      "Đang chờ LinkedIn hiển thị danh sách việc làm...",
      JH_LIST_READY_TIMEOUT_MS,
      "#818CF8",
      () => this.stop()
    );

    const r = await jhWaitForJobCards(
      JH_LIST_READY_TIMEOUT_MS,
      () => !this.isRunning || jhIsStopRequested()
    );

    if (!this.isRunning || jhIsStopRequested()) return false;
    if (r.ok) return true;

    this.reportEmptyList(r.waitedMs);
    return false;
  }

  /**
   * Kết luận khi không có thẻ nào, kèm chẩn đoán cụ thể.
   *
   * Mốc phân biệt là banner của LinkedIn và pagesDone — số trang phiên NÀY thực
   * sự đã đi qua. Bản cũ dùng ckpt.pageIndex > 0, mà pageIndex suy ra từ ?start=
   * của URL, nên ai cào từ trang 3 gặp 0 thẻ sẽ bị báo nhầm là "đã hết kết quả".
   */
  reportEmptyList(waitedMs) {
    const diag = jhDiagnoseJobList({ waitedMs: waitedMs || 0, pageNumber: this.pageNumber });

    if (diag.noResultsBanner || (this.ckpt && (this.ckpt.pagesDone || 0) > 0)) {
      this.stop(`Đã hết kết quả ở trang ${this.pageNumber}.`, "FINISHED");
      return;
    }

    jhLogListDiagnostic(diag);
    this.stop(jhDescribeListDiagnostic(diag), "PAUSED_STUCK");
  }

  /**
   * Dừng cào.
   * Nguyên tắc: LUÔN tạm dừng, KHÔNG BAO GIỜ tự xoá checkpoint — chỉ hành động
   * rõ ràng của người dùng ("Cào Lại Từ Đầu") mới được vứt tiến độ.
   */
  stop(reason = "Đã dừng cào tự động.", status = "PAUSED_USER") {
    this.isRunning = false;
    jhRequestStop();
    jhUpdateCrawlerButton(false);
    jhShowProgressToast(`${reason} Đã đồng bộ ${this.crawledCount} việc làm thật.`, 6000, "#10B981");
    jhEmitCrawlProgress(this, "done", { reason });
    jhPassiveHarvester.resume();

    if (this.ckpt) {
      if (status === "FINISHED") {
        void jhCkptFinish(this.ckpt, reason).then((st) => jhCkptSyncToServer(st));
      } else {
        void jhCkptPause(this.ckpt, status, reason).then((st) => jhCkptSyncToServer(st));
      }
    }
  }

  async processCurrentPage() {
    if (!this.isRunning) return;

    await this.scrollListContainer();
    await jhSleepRandom(400, 800);

    const cards = this.getJobCards();
    if (cards.length === 0) {
      this.reportEmptyList(0);
      return;
    }

    if (this.ckpt) {
      this.ckpt.cardsOnPage = cards.length;
    }
    let processedThisPage = 0;

    for (let i = 0; i < cards.length; i++) {
      // Cờ dừng ở RAM — kiểm ở ĐẦU mỗi vòng để nút Dừng có hiệu lực trong ~1 thẻ
      if (!this.isRunning || jhIsStopRequested()) return;

      const card = cards[i];

      // Bỏ qua theo ID, KHÔNG theo chỉ số: sau khi nạp lại trang LinkedIn dựng
      // lại danh sách với thứ tự có thể khác (tin mới chèn vào, ranking đổi).
      // Bỏ qua N thẻ đầu của danh sách MỚI = bỏ sót việc làm chưa từng cào.
      const cardJobId = jhCardJobId(card);
      if (cardJobId && this.processedUrls.has(`li-${cardJobId}`)) {
        if (this.ckpt) this.ckpt.cardIndex = i + 1;
        continue;
      }

      card.scrollIntoView({ behavior: "smooth", block: "center" });

      const clickTarget = jhQueryFirst(card, JH_CARD_CLICK_SELECTORS) || card;

      if (clickTarget) {
        clickTarget.click();
      }

      // Thời gian chờ ngẫu nhiên giữa các thẻ (tránh chu kỳ cố định)
      const cardDelay = jhGetCardDelay();
      await jhSleepRandom(cardDelay - 100, cardDelay + 100);

      const rawJob = extractRawActiveJob();
      const seenKey = rawJob && rawJob.linkedinJobId ? `li-${rawJob.linkedinJobId}` : rawJob?.pageUrl;

      if (rawJob && rawJob.rawTitle && seenKey && !this.processedUrls.has(seenKey)) {
        this.processedUrls.add(seenKey);
        processedThisPage++;

        try {
          await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                action: "SYNC_JOB_TO_BACKEND",
                payload: { job: rawJob },
              },
              (res) => {
                if (res && res.success) {
                  this.crawledCount++;
                }
                resolve(true);
              }
            );
          });
        } catch (e) {
          console.warn("Lỗi gửi việc làm:", e);
        }
      } else if (rawJob && !rawJob.rawTitle && this.ckpt) {
        this.ckpt.skippedCount = (this.ckpt.skippedCount || 0) + 1;
      }

      this.cardsSinceLastPause++;
      jhEmitCrawlProgress(this, "card");

      // Ghi checkpoint sau MỖI thẻ — đóng tab giữa chừng vẫn tiếp tục được đúng chỗ
      if (this.ckpt) {
        this.ckpt.cardIndex = i + 1;
        this.ckpt.savedCount = this.crawledCount;
        this.ckpt.seen = Array.from(this.processedUrls).slice(-2000); // chặn phình storage
        if (!(await jhCkptSave(this.ckpt))) return; // ai đó đã PAUSE -> dừng ngay
      }

      // Chốt chặn: mở thẻ nào cũng hỏng -> LinkedIn nhiều khả năng đã đổi giao diện
      if (this.ckpt && this.crawledCount === 0 && this.ckpt.skippedCount >= 5) {
        this.stop(
          "Không mở được thẻ việc làm nào (5 thẻ liên tiếp). Hãy đưa tab LinkedIn ra tiền cảnh rồi thử lại.",
          "PAUSED_STUCK"
        );
        return;
      }

      // Khoảng nghỉ ngẫu nhiên mô phỏng người dùng đọc sâu JD sau một số thẻ
      if (this.cardsSinceLastPause >= this.nextPauseThreshold) {
        const pauseDuration = jhGetReadingPauseDuration();
        const pauseSec = (pauseDuration / 1000).toFixed(1);
        jhShowProgressToast(
          `Nghỉ ngẫu nhiên ${pauseSec}s mô phỏng đọc JD... (Đã lưu: ${this.crawledCount})`,
          pauseDuration,
          "#F59E0B",
          () => this.stop()
        );
        await jhSleepRandom(pauseDuration, pauseDuration + 300);
        this.cardsSinceLastPause = 0;
        this.nextPauseThreshold = jhGetNextReadingPauseThreshold();
      } else {
        jhShowProgressToast(
          `Đang cào (Random Delay): Trang ${this.pageNumber} | Thẻ ${i + 1}/${cards.length} (Tổng: ${this.crawledCount})`,
          3500,
          "#818CF8",
          () => this.stop()
        );
      }
    }

    if (!this.isRunning || jhIsStopRequested()) return;

    // Chốt chặn: duyệt hết một trang mà KHÔNG xử lý thẻ nào trong khi trang có thẻ.
    // Đây chính là lớp lỗi "con trỏ thẻ không được đặt lại" — heartbeat vẫn tươi,
    // trang vẫn nhảy, nên không watchdog nào bắt được; crawler chạy hết 40 trang
    // rồi báo "hoàn tất" trong khi chỉ lưu được dữ liệu của trang đầu.
    if (processedThisPage === 0 && cards.length > 0 && this.crawledCount > 0) {
      this.stop(
        `Trang ${this.pageNumber} không xử lý được thẻ nào dù có ${cards.length} thẻ.`,
        "PAUSED_STUCK"
      );
      return;
    }

    await this.navigateToNextPage();
  }

  /**
   * Sang trang kế bằng cách ĐIỀU HƯỚNG THẬT tới &start=N.
   *
   * Không dùng btn.click() nữa: nếu click gây hard navigation thì document bị huỷ
   * giữa lúc `await`, Promise không bao giờ resolve/reject và vòng cào chết im lặng.
   * Chủ động assign URL khiến việc content script nạp lại trở thành bước chuyển
   * trạng thái có kiểm soát — checkpoint trong storage sẽ tiếp quản.
   */
  async navigateToNextPage() {
    if (!this.ckpt) return;

    const nextOffset = (this.ckpt.startOffset || 0) + JH_PAGE_SIZE;
    const nextUrl = jhBuildPageUrl(this.ckpt.searchUrl || location.href, nextOffset);

    this.ckpt.pageIndex = (this.ckpt.pageIndex || 0) + 1;
    // Đếm trang phiên này thực sự đi qua -> phân biệt "hết kết quả" với "lỗi tải"
    this.ckpt.pagesDone = (this.ckpt.pagesDone || 0) + 1;
    this.ckpt.startOffset = nextOffset;
    // BẮT BUỘC đặt lại con trỏ TRONG trang. Thiếu dòng này, trang sau chạy
    // for (i = 25; i < 25) -> duyệt 0 thẻ mà vẫn báo thành công.
    this.ckpt.cardIndex = 0;
    this.ckpt.cardsOnPage = 0;
    this.ckpt.savedCount = this.crawledCount;
    this.ckpt.seen = Array.from(this.processedUrls).slice(-2000);
    jhCkptIssueExpect(this.ckpt, nextOffset);

    if (!(await jhCkptSave(this.ckpt))) return;
    jhCkptSyncToServer(this.ckpt);

    this.pageNumber = this.ckpt.pageIndex + 1;
    jhEmitCrawlProgress(this, "page");

    const pageDelay = jhGetPageDelay();
    jhShowProgressToast(
      `Chuyển sang Trang ${this.pageNumber} (chờ ${(pageDelay / 1000).toFixed(1)}s)...`,
      pageDelay,
      "#818CF8",
      () => this.stop()
    );
    await jhSleepRandom(pageDelay, pageDelay + 400);

    if (!this.isRunning || jhIsStopRequested()) return;

    // Sau dòng này document sẽ bị huỷ; luồng cào tiếp tục ở lần nạp sau
    // thông qua bắt tay CONTENT_READY.
    location.assign(nextUrl);
  }

}

const crawlerInstance = new LinkedInAutoCrawler();

/**
 * Áp trạng thái chế độ ghi (hai tầng) vào tab này.
 *
 * `persist = false` khi lệnh đến TỪ background: background đã ghi storage trước
 * khi phát xuống các tab, ghi lại ở đây chỉ tạo thêm một vòng ghi thừa.
 */
function jhApplyRecordState({ enabled, autoOpen }, persist = true) {
  if (enabled) {
    jhPassiveHarvester.enable(autoOpen);
  } else {
    jhPassiveHarvester.disable();
  }
  jhUpdatePassiveIndicator(
    jhPassiveHarvester.enabled,
    jhPassiveHarvester.savedCount,
    jhPassiveHarvester.autoOpen
  );

  if (persist) {
    try {
      chrome.storage.local.set(
        { [JH_RECORD_KEY]: !!enabled, [JH_AUTO_OPEN_KEY]: !!autoOpen },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {}
  }
}

/** Đổi một tầng công tắc rồi phát qua background để mọi tab + popup + Dashboard cùng khớp. */
function jhRequestRecordChange(patch) {
  const next = {
    enabled: jhPassiveHarvester.enabled,
    autoOpen: jhPassiveHarvester.autoOpen,
    ...patch,
  };

  try {
    chrome.runtime.sendMessage(
      { action: "SET_PASSIVE_ENABLED", enabled: next.enabled, autoOpen: next.autoOpen },
      (res) => {
        void chrome.runtime.lastError;
        // Background im lặng (worker vừa bị hủy) -> vẫn áp tại chỗ để nút không kẹt.
        if (!res || !res.success) jhApplyRecordState(next);
      }
    );
  } catch (e) {
    jhApplyRecordState(next);
  }
}

function initExtensionUI() {
  jhInjectFloatingWidget({
    onToggleAuto: () => {
      if (crawlerInstance.isRunning) {
        crawlerInstance.stop();
      } else if (crawlerInstance.pendingResume) {
        // Có phiên dở dang -> tiếp tục đúng chỗ thay vì cào lại từ trang 1
        const st = crawlerInstance.pendingResume;
        crawlerInstance.pendingResume = null;
        crawlerInstance.start({ checkpoint: st, origin: "WIDGET" });
      } else {
        crawlerInstance.start({ origin: "WIDGET" });
      }
    },
    onSyncActive: () => {
      const raw = extractRawActiveJob();
      // Chặn sớm khi bóc tách thiếu dữ liệu thật, khớp với popup.js và passive
      // harvester — trước đây chỉ ở đây là gửi bừa rồi im lặng nếu máy chủ từ chối.
      if (!raw || raw.extractOk === false) {
        const missing = (raw && raw.missingFields || []).join(", ") || "không rõ";
        jhShowProgressToast(`Không đọc đủ dữ liệu việc làm (thiếu: ${missing}).`, 5000, "#EF4444");
        return;
      }
      chrome.runtime.sendMessage({ action: "SYNC_JOB_TO_BACKEND", payload: { job: raw } }, (res) => {
        if (res && res.success) {
          jhShowProgressToast(`Đã đồng bộ: ${res.data?.data?.[0]?.title || "Việc làm"}`, 3500, "#10B981");
        } else {
          const why = (res && (res.message || res.code)) || "máy chủ không phản hồi";
          jhShowProgressToast(`Đồng bộ thất bại: ${why}`, 5000, "#EF4444");
        }
      });
    },
    onTogglePassive: () => {
      const next = !jhPassiveHarvester.enabled;
      // Tắt chế độ ghi thì hạ luôn tầng phụ: bật lại lần sau phải là một quyết
      // định mới, không được âm thầm kế thừa quyền tự click từ phiên trước.
      jhRequestRecordChange({ enabled: next, autoOpen: next ? jhPassiveHarvester.autoOpen : false });
    },
    onToggleAutoOpen: () => {
      if (!jhPassiveHarvester.enabled) return;
      jhRequestRecordChange({ autoOpen: !jhPassiveHarvester.autoOpen });
    },
  });

  jhUpdateCrawlerButton(crawlerInstance.isRunning);
  jhUpdatePassiveIndicator(
    jhPassiveHarvester.enabled,
    jhPassiveHarvester.savedCount,
    jhPassiveHarvester.autoOpen
  );
}

try {
  initExtensionUI();
} catch (e) {}

setInterval(() => {
  if (!document.getElementById("job-hunter-floating-widget")) {
    initExtensionUI();
  }
}, 2000);

// Chế độ ghi mặc định TẮT: đọc bằng `=== true` nên chưa từng bật = không ghi gì.
// Luôn áp trạng thái đọc được (kể cả TẮT) thay vì chỉ áp khi bật — để nhãn trên
// widget phản ánh đúng sự thật ngay từ lần render đầu.
try {
  chrome.storage.local.get([JH_RECORD_KEY, JH_AUTO_OPEN_KEY], (res) => {
    if (chrome.runtime.lastError) return;
    jhApplyRecordState(
      {
        enabled: !!res && res[JH_RECORD_KEY] === true,
        autoOpen: !!res && res[JH_AUTO_OPEN_KEY] === true,
      },
      false
    );
  });
} catch (e) {}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_AUTO_CRAWL") {
    crawlerInstance.start({ sessionId: request.sessionId, origin: request.origin || "POPUP" });
    sendResponse({ success: true, isRunning: true });
  } else if (request.action === "STOP_AUTO_CRAWL") {
    crawlerInstance.stop();
    sendResponse({ success: true, isRunning: false });
  } else if (request.action === "GET_CRAWL_STATUS") {
    sendResponse({
      success: true,
      isRunning: crawlerInstance.isRunning,
      crawledCount: crawlerInstance.crawledCount,
      pageNumber: crawlerInstance.pageNumber,
      passiveEnabled: jhPassiveHarvester.enabled,
      passiveAutoOpen: jhPassiveHarvester.autoOpen,
      passiveCount: jhPassiveHarvester.savedCount,
    });
  } else if (request.action === "SET_PASSIVE_ENABLED") {
    // Background đã ghi storage trước khi phát xuống các tab — không ghi lại.
    jhApplyRecordState({ enabled: !!request.enabled, autoOpen: !!request.autoOpen }, false);
    sendResponse({
      success: true,
      passiveEnabled: jhPassiveHarvester.enabled,
      passiveAutoOpen: jhPassiveHarvester.autoOpen,
      passiveCount: jhPassiveHarvester.savedCount,
    });
  } else if (request.action === "GET_ACTIVE_JOB") {
    sendResponse({ success: true, data: extractRawActiveJob() });
  }
  return true;
});

/**
 * Bắt tay kiểu PULL với background.
 *
 * Nếu để background "đẩy" START_AUTO_CRAWL xuống sau tabs.onUpdated status:"complete"
 * thì sẽ gặp race — "complete" bắn theo sự kiện load, không đảm bảo listener ở trên
 * đã đăng ký xong, dẫn tới lỗi "Receiving end does not exist". Cho content script tự
 * hỏi thì race biến mất.
 *
 * PHẢI là câu lệnh cuối cùng của file để listener chắc chắn đã sẵn sàng trước.
 */
function jhAnnounceReady(attempt = 0) {
  try {
    chrome.runtime.sendMessage(
      { action: "CONTENT_READY", url: location.href, title: document.title },
      (res) => {
        if (chrome.runtime.lastError || !res) return;

        if (res.startCrawl) {
          crawlerInstance.start({ sessionId: res.sessionId, remote: true, origin: "DASHBOARD" });
        } else if (res.retryInMs && attempt < 4) {
          setTimeout(() => jhAnnounceReady(attempt + 1), res.retryInMs);
        }
      }
    );
  } catch (e) {}
}

/**
 * Tiếp quản phiên cào sau khi trang được nạp lại.
 *
 * Chụp URL ở ngay đây, TRƯỚC mọi await: router của LinkedIn có thể replaceState
 * viết lại URL chỉ sau một vòng I/O, khi đó `start` đọc được sẽ sai.
 */
const JH_BOOT_HREF = location.href;

async function jhBootstrapResume() {
  let st;
  try {
    st = await jhCkptLoad();
  } catch (e) {
    return;
  }
  if (!st) return;

  // Chính crawler vừa điều hướng tới đây -> chạy tiếp, không hỏi.
  // Việc chờ danh sách render do start() -> ensureJobListReady() lo, dùng chung
  // với ba đường vào còn lại; giữ thêm một vòng chờ ở đây chỉ tạo bản sao để trôi lệch.
  if (jhCkptIsOurNavigation(st, JH_BOOT_HREF)) {
    st.expect = null;
    crawlerInstance.start({ checkpoint: st, origin: st.origin || "WIDGET" });
    return;
  }

  // Người dùng tự mở trang: có phiên dở dang cùng tìm kiếm -> mời tiếp tục,
  // KHÔNG tự động cào (tránh cào ngoài ý muốn).
  if (jhCkptIsResumable(st) && st.searchKey === jhSearchKey(JH_BOOT_HREF)) {
    jhShowProgressToast(
      `Có phiên cào dở dang: ${jhCkptSummary(st)}. Bấm nút cào để tiếp tục.`,
      12000,
      "#F59E0B"
    );
    crawlerInstance.pendingResume = st;
  }
}

jhAnnounceReady();
void jhBootstrapResume();
