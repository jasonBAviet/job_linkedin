/**
 * LinkedIn Job Hunter - Passive Scroll Harvester ("Chế độ ghi")
 *
 * KHÔNG tự cuộn, KHÔNG tự chuyển trang. Người dùng lướt danh sách việc làm như
 * bình thường; extension chỉ đi theo sau hành vi thật của họ — nên dấu vết tự
 * động hoá thấp hơn hẳn LinkedInAutoCrawler (vốn chủ động click hàng loạt).
 *
 * HAI TẦNG CÔNG TẮC, cả hai đều mặc định TẮT (opt-in thật sự):
 *
 *   enabled  = false  ->  không ghi gì cả. Không observer, không poll, không click.
 *   enabled  = true   ->  ghi JD nào người dùng TỰ BẤM MỞ (bám `location` qua detailPoll).
 *   + autoOpen = true ->  ghi thêm: thẻ nào dừng trong tầm nhìn đủ lâu thì tự mở rồi ghi.
 *
 * Tách làm hai vì đó là hai mức xâm lấn khác hẳn nhau: tầng một chỉ quan sát,
 * tầng hai mới thực sự điều khiển trang thay người dùng (`clickTarget.click()`).
 * Gộp chung thành một nút thì bật để "lưu JD tôi đang đọc" sẽ vô tình kéo theo
 * việc trang tự nhảy pane chi tiết mỗi lần cuộn.
 *
 * Chế độ ghi TỰ TẮT khi xong một mẻ — xem `autoOff()`.
 */

/**
 * Khóa storage cho hai tầng công tắc.
 *
 * CỐ TÌNH đặt tên mới thay vì tái dùng `passiveEnabled` cũ. Khóa cũ mang ngữ
 * nghĩa opt-out (`!== false` nên "chưa từng bấm" = ĐANG BẬT); giữ nguyên tên mà
 * đổi ngữ nghĩa thì giá trị `true` còn sót trong máy người dùng vẫn khiến chế độ
 * bật ngay sau khi cập nhật — đúng cái lỗi đang phải sửa. Background xóa khóa cũ
 * khi khởi động; hằng số này phải khớp bản sao trong background.js.
 */
const JH_RECORD_KEY = "jhRecordEnabled";
const JH_AUTO_OPEN_KEY = "jhAutoOpenEnabled";

const JH_PASSIVE_CONFIG = {
  // Thẻ phải lộ ít nhất bao nhiêu phần trăm mới được tính là "đang xem"
  VIEWPORT_RATIO: 0.6,
  // Thời gian thẻ phải nằm yên trong tầm nhìn trước khi được xếp hàng
  DWELL_MS: 900,
  // Người dùng phải ngưng thao tác bấy lâu thì mới được phép mở JD thay họ
  USER_IDLE_MS: 1200,
  // Giãn cách ngẫu nhiên giữa hai lần mở JD
  GAP_MIN_MS: 1600,
  GAP_MAX_MS: 3400,
  // Thời gian chờ pane chi tiết ổn định sau khi click
  DETAIL_SETTLE_MS: 1300,
  MAX_QUEUE: 15,
  // Không ghi thêm được JD nào trong bấy lâu -> coi như xong mẻ, tự tắt
  AUTO_OFF_IDLE_MS: 120000,
};

/** Diễn giải lý do tự tắt cho người dùng đọc. */
function jhAutoOffLabel(reason) {
  if (reason === "idle") return "không có việc làm mới trong 2 phút";
  if (reason === "navigated") return "đã rời danh sách việc làm";
  return "đã xong";
}

// JH_JOB_CARD_SELECTORS, JH_CARD_CLICK_SELECTORS và jhGetJobCardElements đã chuyển
// sang lib/selectors.js (nạp trước file này). Không khai báo lại ở đây: `const`
// trùng tên ném SyntaxError giết cả file, còn `function` trùng tên thì file nạp
// SAU lặng lẽ thắng — đúng cơ chế đã khiến các bản sao trôi lệch nhau âm thầm.

/** Khóa định danh ổn định cho một thẻ, để khử trùng lặp. */
function jhCardKey(card) {
  if (!card) return null;

  const id = jhCardJobIdFrom(card);
  if (id) return `id:${id}`;

  const link = card.querySelector && card.querySelector("a[href*='/jobs/view/']");
  if (link && link.href) return `href:${link.href.split("?")[0]}`;

  return null;
}

function jhIsJobsPage() {
  return /^\/jobs(\/|$)/.test(location.pathname);
}

class JhPassiveHarvester {
  constructor() {
    this.enabled = false;
    this.autoOpen = false; // tầng phụ: có được tự mở thẻ khi cuộn hay không
    this.suspended = false; // tạm ngưng khi bộ cào tự động đang chạy
    this.savedCount = 0;
    // Hai tập KHÁC NHAU: thẻ đã ghé qua (để khỏi click lại) và JD đã gửi (để khỏi
    // gửi trùng). Gộp chung sẽ khiến việc đánh dấu thẻ chặn luôn lần gửi của
    // chính thẻ đó, vì cả hai đều dùng khóa `id:<jobId>`.
    this.visitedCards = new Set();
    this.syncedJobs = new Set();
    this.lastExtractedUrl = null;
    this.queue = [];
    this.observer = null;
    this.listObserver = null;
    this.detailPoll = null;
    // Giữ tham chiếu tới chính hàm check để gỡ được listener `popstate` lúc tắt.
    // Dùng closure ẩn danh thì mỗi vòng bật/tắt lại cộng thêm một listener.
    this.detailCheck = null;
    this.idleTimer = null;
    // Tab này đã từng thực sự đứng trên danh sách việc làm hay chưa. Quyết định
    // "rời /jobs" có phải là kết thúc một mẻ ghi, hay chỉ là tab chưa bao giờ
    // tới đó — xem watchDetailPane().
    this.wasOnJobsPage = false;
    this.dwellTimers = new Map();
    this.lastUserActionAt = Date.now();
    this.draining = false;
    this.userActivityBound = false;
  }

  /* ---------------- Vòng đời ---------------- */

  /**
   * KHÔNG chốt `jhIsJobsPage()` ở đây.
   *
   * Content script nạp trên mọi trang linkedin.com. Bật chế độ ghi trong lúc
   * đang đứng ở /feed mà bail sớm thì tab đó câm vĩnh viễn — SPA điều hướng
   * sang /jobs không chạy lại enable() nên phải F5 mới thu thập được, đồng thời
   * widget hiện TẮT còn popup hiện BẬT. Thay vào đó cứ bật, rồi để poll ở
   * watchDetailPane() phát hiện lúc tab thật sự tới /jobs.
   */
  enable(autoOpen = false) {
    const first = !this.enabled;
    this.enabled = true;
    if (jhIsJobsPage()) this.wasOnJobsPage = true;

    if (first) {
      // Mỗi lần bật là một mẻ mới -> đếm lại từ đầu cho khớp toast "đã ghi xong N".
      this.savedCount = 0;
      this.bindUserActivity();
      if (!this.detailPoll) this.watchDetailPane();
      this.armIdleTimer();
    }

    this.setAutoOpen(autoOpen);
    if (first) this.emitProgress("enabled");
  }

  /** Bật/tắt riêng tầng tự mở thẻ, KHÔNG đụng tới chế độ ghi. */
  setAutoOpen(autoOpen) {
    this.autoOpen = !!autoOpen;
    if (this.autoOpen) {
      this.startObserving();
    } else {
      this.stopObserving();
    }
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.autoOpen = false;
    // Đặt lại để lần bật sau được chấm điểm theo trang HIỆN TẠI. Giữ lại `true`
    // thì bật lại từ /feed (sau khi đã ghi ở /jobs) sẽ tự tắt ngay lập tức.
    this.wasOnJobsPage = false;
    this.stopObserving();
    this.stopDetailWatch();
    this.clearIdleTimer();
    this.emitProgress("disabled");
  }

  /** Bộ cào tự động đang chạy — nó tự click thẻ nên phải ngưng để không giẫm chân nhau. */
  suspend() {
    this.suspended = true;
    this.queue = [];
    this.clearDwellTimers();
    // Bộ cào tự động đang làm việc, đừng tính quãng này là "im lặng" rồi tự tắt.
    this.clearIdleTimer();
  }

  resume() {
    this.suspended = false;
    if (!this.enabled) return;
    this.startObserving();
    this.armIdleTimer();
  }

  stopObserving() {
    this.queue = [];
    this.clearDwellTimers();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.listObserver) {
      this.listObserver.disconnect();
      this.listObserver = null;
    }
  }

  stopDetailWatch() {
    if (this.detailPoll) {
      clearInterval(this.detailPoll);
      this.detailPoll = null;
    }
    if (this.detailCheck) {
      window.removeEventListener("popstate", this.detailCheck);
      this.detailCheck = null;
    }
    // Quên mốc URL cũ: lần bật sau, JD đang mở sẵn phải được coi là mới để ghi.
    this.lastExtractedUrl = null;
  }

  clearDwellTimers() {
    for (const timer of this.dwellTimers.values()) clearTimeout(timer);
    this.dwellTimers.clear();
  }

  /* ---------------- Tự tắt khi xong một mẻ ---------------- */

  armIdleTimer(delayMs) {
    this.clearIdleTimer();
    if (!this.enabled || this.suspended) return;

    const wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : JH_PASSIVE_CONFIG.AUTO_OFF_IDLE_MS;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.onIdleTimeout();
    }, wait);
  }

  /**
   * Hết giờ im lặng ở TAB NÀY — chưa chắc đã im lặng ở mọi tab.
   *
   * Ctrl+click một việc làm là có ngay một tab LinkedIn ngồi không; để nó tự
   * quyết thì sau 2 phút nó sẽ tắt mẻ ghi đang chạy ngon lành ở tab kia. Mốc
   * "lần ghi gần nhất" vì thế phải là toàn cục, và background là nơi duy nhất
   * nhìn thấy hết mọi tab.
   */
  onIdleTimeout() {
    if (!this.enabled || this.suspended) return;

    try {
      chrome.runtime.sendMessage({ action: "PASSIVE_IDLE_CHECK" }, (res) => {
        void chrome.runtime.lastError;
        if (!this.enabled || this.suspended) return;

        // Background im lặng (worker vừa bị hủy) -> thà tắt còn hơn ghi tiếp
        // ngoài ý muốn; đó là toàn bộ lý do tồn tại của mốc tự tắt này.
        if (!res || res.offNow) {
          this.autoOff("idle");
        } else {
          this.armIdleTimer(res.retryInMs);
        }
      });
    } catch (e) {
      this.autoOff("idle");
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Tự tắt chế độ ghi khi đã xong một mẻ.
   *
   * KHÔNG tự ghi storage ở đây mà báo lên background, để đi đúng một đường với
   * thao tác tắt tay: background ghi storage -> phát xuống MỌI tab LinkedIn ->
   * báo về Dashboard. Lệnh phát ngược lại chính tab này gọi disable() lần nữa,
   * vốn idempotent nên vô hại.
   */
  autoOff(reason) {
    if (!this.enabled) return;

    const saved = this.savedCount;
    // Tắt tại chỗ TRƯỚC khi chờ background trả lời, để không kịp ghi thêm JD nào.
    this.disable();

    try {
      chrome.runtime.sendMessage(
        { action: "SET_PASSIVE_ENABLED", enabled: false, reason },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {}

    const why = jhAutoOffLabel(reason);
    jhShowProgressToast(
      saved > 0
        ? `Đã ghi xong ${saved} việc làm — tắt chế độ ghi (${why}).`
        : `Đã tắt chế độ ghi (${why}).`,
      5000,
      "#F59E0B"
    );
  }

  /* ---------------- Theo dõi hành vi người dùng ---------------- */

  bindUserActivity() {
    if (this.userActivityBound) return;
    this.userActivityBound = true;

    const mark = () => {
      this.lastUserActionAt = Date.now();
    };
    // Cuộn KHÔNG tính là "đang thao tác" — cuộn chính là tín hiệu mời thu thập.
    for (const evt of ["mousedown", "keydown", "touchstart"]) {
      window.addEventListener(evt, mark, { passive: true, capture: true });
    }
  }

  isUserIdle() {
    return Date.now() - this.lastUserActionAt >= JH_PASSIVE_CONFIG.USER_IDLE_MS;
  }

  /* ---------------- Quan sát tầm nhìn ---------------- */

  startObserving() {
    if (!this.enabled || this.suspended) return;
    // Tầng tự mở thẻ chưa bật -> không dựng observer nào cả.
    if (!this.autoOpen) return;
    // Content script được nạp trên MỌI trang linkedin.com, không riêng /jobs;
    // enable() có chốt này rồi nhưng SPA có thể điều hướng sau đó.
    if (!jhIsJobsPage()) return;
    if (typeof IntersectionObserver === "undefined") return;

    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => this.onIntersect(entries), {
        threshold: [JH_PASSIVE_CONFIG.VIEWPORT_RATIO],
      });
    }

    for (const card of jhGetJobCardElements()) {
      const key = jhCardKey(card);
      if (!key || this.visitedCards.has(key)) continue;
      try {
        this.observer.observe(card);
      } catch (e) {}
    }

    // Danh sách LinkedIn nạp thêm thẻ khi cuộn -> phải bắt thẻ mới xuất hiện.
    // Quét lại có tiết chế: LinkedIn đột biến DOM liên tục, quét mỗi lần là phí.
    if (!this.listObserver && typeof MutationObserver !== "undefined") {
      const container = jhGetListContainer() || document.body;

      let rescanTimer = null;
      this.listObserver = new MutationObserver(() => {
        if (!this.enabled || !this.autoOpen || this.suspended || rescanTimer) return;
        rescanTimer = setTimeout(() => {
          rescanTimer = null;
          this.startObserving();
        }, 500);
      });
      try {
        this.listObserver.observe(container, { childList: true, subtree: true });
      } catch (e) {}
    }
  }

  onIntersect(entries) {
    if (!this.enabled || !this.autoOpen || this.suspended) return;

    for (const entry of entries) {
      const card = entry.target;
      const key = jhCardKey(card);
      if (!key) continue;

      if (!entry.isIntersecting || entry.intersectionRatio < JH_PASSIVE_CONFIG.VIEWPORT_RATIO) {
        const timer = this.dwellTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.dwellTimers.delete(key);
        }
        continue;
      }

      if (this.dwellTimers.has(key) || this.visitedCards.has(key)) continue;

      const timer = setTimeout(() => {
        this.dwellTimers.delete(key);
        this.enqueue(card, key);
      }, JH_PASSIVE_CONFIG.DWELL_MS);

      this.dwellTimers.set(key, timer);
    }
  }

  enqueue(card, key) {
    if (!this.enabled || !this.autoOpen || this.suspended) return;
    if (this.visitedCards.has(key)) return;
    if (this.queue.some((item) => item.key === key)) return;
    if (this.queue.length >= JH_PASSIVE_CONFIG.MAX_QUEUE) return;
    if (!document.contains(card)) return;

    this.queue.push({ card, key });
    this.drain();
  }

  /* ---------------- Xử lý hàng đợi ---------------- */

  async drain() {
    if (this.draining) return;
    this.draining = true;

    try {
      while (this.enabled && this.autoOpen && !this.suspended && this.queue.length > 0) {
        // Nhường người dùng: chỉ hành động khi họ đang không thao tác
        if (!this.isUserIdle()) {
          await jhSleepRandom(400, 700);
          continue;
        }

        const item = this.queue.shift();
        if (!item || !document.contains(item.card)) continue;
        if (this.visitedCards.has(item.key)) continue;

        await this.captureCard(item);
        await jhSleepRandom(JH_PASSIVE_CONFIG.GAP_MIN_MS, JH_PASSIVE_CONFIG.GAP_MAX_MS);
      }
    } catch (e) {
      console.warn("[JobHunter] Lỗi trong bộ thu thập thụ động:", e);
    } finally {
      this.draining = false;
    }
  }

  async captureCard(item) {
    const clickTarget = jhQueryFirst(item.card, JH_CARD_CLICK_SELECTORS) || item.card;

    // Đánh dấu ĐÃ GHÉ trước khi click để không xếp hàng lại thẻ này,
    // nhưng KHÔNG dùng chung tập với JD đã gửi.
    this.visitedCards.add(item.key);

    try {
      clickTarget.click();
    } catch (e) {
      return;
    }

    await jhSleepRandom(
      JH_PASSIVE_CONFIG.DETAIL_SETTLE_MS - 200,
      JH_PASSIVE_CONFIG.DETAIL_SETTLE_MS + 400
    );

    // Người dùng có thể đã tắt chế độ ghi trong lúc chờ pane ổn định.
    if (!this.enabled || !this.autoOpen || this.suspended) return;

    await this.syncActiveJob("scroll");
  }

  /**
   * Bóc tách JD đang mở ở pane chi tiết rồi gửi về máy chủ.
   * Chỉ gửi khi bóc tách thành công — tuyệt đối không gửi bản ghi thiếu mô tả.
   */
  async syncActiveJob(source) {
    // Chốt ngay tại đây chứ không chỉ ở phía gọi: hàm này `async` và luôn được
    // await sau một quãng sleep, nên chế độ ghi có thể đã tắt giữa chừng.
    if (!this.enabled || this.suspended) return false;

    let rawJob = null;
    try {
      rawJob = extractRawActiveJob();
    } catch (e) {
      return false;
    }

    if (!rawJob || !rawJob.extractOk) return false;

    const jobKey = rawJob.linkedinJobId
      ? `job:${rawJob.linkedinJobId}`
      : `job:${(rawJob.pageUrl || "").split("?")[0]}`;
    if (this.syncedJobs.has(jobKey)) return false;

    this.syncedJobs.add(jobKey);

    const ok = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: "SYNC_JOB_TO_BACKEND", payload: { job: rawJob } },
          (res) => {
            void chrome.runtime.lastError;
            resolve(!!(res && res.success));
          }
        );
      } catch (e) {
        resolve(false);
      }
    });

    if (ok) {
      this.savedCount++;
      // Vừa ghi được -> mẻ này chưa xong, dời mốc tự tắt ra sau.
      this.armIdleTimer();
      this.emitProgress(source);
      jhShowProgressToast(
        `Chế độ ghi: đã lưu ${this.savedCount} việc làm (${rawJob.rawTitle || "JD"})`,
        2500,
        "#38BDF8"
      );
      jhUpdatePassiveIndicator(this.enabled, this.savedCount, this.autoOpen);
    }

    return ok;
  }

  /**
   * Bắt luôn JD do chính người dùng bấm mở — không tốn thao tác tự động nào.
   */
  watchDetailPane() {
    // LinkedIn là SPA, mở JD không đổi document — nhưng luôn đổi ?currentJobId
    // hoặc đường dẫn. Bám vào đó rẻ hơn nhiều so với quan sát toàn bộ DOM, và
    // tránh gọi extractRawActiveJob() hàng nghìn lần mỗi phút.
    const check = () => {
      if (!this.enabled || this.suspended) return;

      if (!jhIsJobsPage()) {
        // Đã từng ghi ở tab này rồi mới rời đi -> xong một mẻ, tự tắt. Còn tab
        // chưa bao giờ tới /jobs (bật từ /feed) thì chỉ nằm chờ, tắt ở đây sẽ
        // giết luôn mẻ ghi đang chạy ngon lành ở tab LinkedIn khác.
        if (this.wasOnJobsPage) this.autoOff("navigated");
        return;
      }

      // Vừa đặt chân tới danh sách việc làm -> mới là lúc dựng observer.
      if (!this.wasOnJobsPage) {
        this.wasOnJobsPage = true;
        this.startObserving();
      }

      const marker = location.pathname + location.search;
      if (marker === this.lastExtractedUrl) return;
      this.lastExtractedUrl = marker;

      setTimeout(() => {
        if (this.enabled && !this.suspended) this.syncActiveJob("view");
      }, JH_PASSIVE_CONFIG.DETAIL_SETTLE_MS);
    };

    this.detailCheck = check;
    this.detailPoll = setInterval(check, 700);
    window.addEventListener("popstate", check);
    check();
  }

  emitProgress(phase) {
    try {
      chrome.runtime.sendMessage(
        {
          action: "PASSIVE_PROGRESS",
          phase,
          enabled: this.enabled,
          autoOpen: this.autoOpen,
          savedCount: this.savedCount,
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {}
  }
}

const jhPassiveHarvester = new JhPassiveHarvester();
