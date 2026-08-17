/**
 * LinkedIn Job Hunter - Anti-Detection & Human Behavior Simulation Module
 * Cung cấp cơ chế tạo độ trễ ngẫu nhiên (Random Jitter Delay) và mô phỏng hành vi người dùng.
 */

const JH_ANTI_DETECTION_CONFIG = {
  // Khoảng thời gian chờ ngẫu nhiên giữa các thẻ việc làm (ms)
  CARD_DELAY_MIN: 1800,
  CARD_DELAY_MAX: 3800,

  // Khoảng thời gian chờ sau khi bấm chuyển trang (ms)
  PAGE_DELAY_MIN: 3500,
  PAGE_DELAY_MAX: 6500,

  // Khoảng thời gian chờ giữa các bước cuộn danh sách (ms)
  SCROLL_STEP_DELAY_MIN: 220,
  SCROLL_STEP_DELAY_MAX: 480,

  // Tần suất kích hoạt khoảng dừng đọc sâu JD (sau mỗi 3 đến 6 thẻ)
  READING_PAUSE_INTERVAL_MIN: 3,
  READING_PAUSE_INTERVAL_MAX: 6,

  // Thời gian dừng đọc sâu JD (ms)
  READING_PAUSE_DURATION_MIN: 4000,
  READING_PAUSE_DURATION_MAX: 7500,
};

/**
 * Sinh số nguyên ngẫu nhiên trong khoảng [min, max]
 */
function jhRandomBetween(min, max) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

/**
 * Thêm nhiễu ngẫu nhiên (Jitter) theo phân phối tương tự Gaussian
 */
function jhAddJitter(baseValue, jitterRange = 150) {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
  const offset = randStdNormal * (jitterRange / 2);
  return Math.max(300, Math.round(baseValue + offset));
}

/**
 * Tạm dừng ngẫu nhiên trong khoảng [minMs, maxMs] kèm jitter
 */
function jhSleepRandom(minMs, maxMs) {
  const base = jhRandomBetween(minMs, maxMs);
  const finalDuration = jhAddJitter(base, 180);
  return new Promise((resolve) => setTimeout(resolve, finalDuration));
}

/**
 * Lấy độ trễ ngẫu nhiên khi thao tác trên thẻ việc làm
 */
function jhGetCardDelay() {
  return jhRandomBetween(
    JH_ANTI_DETECTION_CONFIG.CARD_DELAY_MIN,
    JH_ANTI_DETECTION_CONFIG.CARD_DELAY_MAX
  );
}

/**
 * Lấy độ trễ ngẫu nhiên khi chuyển trang danh sách tìm kiếm
 */
function jhGetPageDelay() {
  return jhRandomBetween(
    JH_ANTI_DETECTION_CONFIG.PAGE_DELAY_MIN,
    JH_ANTI_DETECTION_CONFIG.PAGE_DELAY_MAX
  );
}

/**
 * Lấy độ trễ ngẫu nhiên cho mỗi bước cuộn danh sách
 */
function jhGetScrollStepDelay() {
  return jhRandomBetween(
    JH_ANTI_DETECTION_CONFIG.SCROLL_STEP_DELAY_MIN,
    JH_ANTI_DETECTION_CONFIG.SCROLL_STEP_DELAY_MAX
  );
}

/**
 * Xác định ngưỡng số thẻ cần cào trước khi thực hiện khoảng nghỉ đọc sâu
 */
function jhGetNextReadingPauseThreshold() {
  return jhRandomBetween(
    JH_ANTI_DETECTION_CONFIG.READING_PAUSE_INTERVAL_MIN,
    JH_ANTI_DETECTION_CONFIG.READING_PAUSE_INTERVAL_MAX
  );
}

/**
 * Lấy thời lượng nghỉ ngơi đọc sâu JD
 */
function jhGetReadingPauseDuration() {
  return jhRandomBetween(
    JH_ANTI_DETECTION_CONFIG.READING_PAUSE_DURATION_MIN,
    JH_ANTI_DETECTION_CONFIG.READING_PAUSE_DURATION_MAX
  );
}
