/**
 * LinkedIn Job Hunter - Job Detail Extractor Module
 * Chuyên trách bóc tách các trường thông tin chi tiết từ giao diện việc làm LinkedIn.
 */

function jhGetJobDetailRoot() {
  return (
    jhQueryFirst(document, [
      ".jobs-search__job-details--wrapper",
      ".jobs-search__job-details",
      ".job-details-jobs-unified-top-card__container--two-pane",
      ".jobs-details__main-content",
      ".jobs-details",
    ]) || null
  );
}

function jhGetJobId(href) {
  try {
    const u = new URL(href || window.location.href);
    const m = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/);
    if (m) return m[1];
    const cur = u.searchParams.get("currentJobId");
    if (cur && /^\d{6,}$/.test(cur)) return cur;
  } catch (e) {}
  return null;
}

function jhReadDescription(root) {
  const el = jhQueryFirst(root || document, [
    "#job-details",
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description__content",
  ]);
  if (!el) return "";

  const btn = jhQueryFirst(root || document, [
    ".jobs-description__footer-button",
    ".feed-shared-inline-show-more-text__see-more-less-toggle",
    'button.artdeco-button[aria-label*="see more" i]',
  ]);
  if (btn && btn.getAttribute("aria-expanded") !== "true") {
    try {
      btn.click();
    } catch (e) {}
  }
  return jhCleanText(el);
}

function extractRawActiveJob() {
  const root = jhGetJobDetailRoot();
  const scope = root || document;

  const rawTitle = jhTextOf(scope, [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1",
  ]);

  const rawCompany = jhTextOf(scope, [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".artdeco-entity-lockup__subtitle",
    "a[href*='/company/']",
  ]);

  const logoEl = jhQueryFirst(scope, [
    ".job-details-jobs-unified-top-card__company-logo img",
    ".jobs-unified-top-card__company-logo img",
    "img[src*='media.licdn.com/dms/image']",
    ".ivm-view-attr__img--centered",
    ".evi-image",
  ]);
  const companyLogo = logoEl ? logoEl.src || logoEl.getAttribute("src") || "" : "";

  const primaryDescription = jhTextOf(scope, [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__primary-description",
    ".jobs-unified-top-card__primary-description",
  ]);

  const tertiaryDescription = jhTextOf(scope, [
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description",
    ".jobs-unified-top-card__tertiary-description",
  ]);

  const rawBadges = [];
  const addTokens = (txt) => {
    if (!txt) return;
    txt.split(/[\n·•]+/).map((s) => s.trim()).filter((s) => s.length > 0).forEach((s) => {
      if (!rawBadges.includes(s)) rawBadges.push(s);
    });
  };

  addTokens(primaryDescription);
  addTokens(tertiaryDescription);

  try {
    scope.querySelectorAll(
      ".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .job-details-preferences-and-skills__pill, .job-details-fit-level-preferences button, .artdeco-pill"
    ).forEach((el) => {
      addTokens(jhCleanText(el));
    });
  } catch (e) {}

  const applyBtn = jhQueryFirst(scope, [
    ".jobs-apply-button--top-card",
    "button.jobs-apply-button",
    "button[data-control-name='jobdetails_topcard_inapply']",
    ".jobs-s-apply button",
  ]);
  const applyBtnText = applyBtn ? jhCleanText(applyBtn).toLowerCase() : "";
  const isEasyApply =
    applyBtnText.includes("easy apply") ||
    applyBtnText.includes("ứng tuyển dễ dàng") ||
    rawBadges.some((b) => /easy\s*apply|ứng tuyển dễ dàng/i.test(b));

  if (isEasyApply && !rawBadges.includes("Easy Apply")) {
    rawBadges.push("Easy Apply");
  }

  const rawContent = jhReadDescription(scope);
  let linkedinUrl = window.location.href;
  const jobId = jhGetJobId(linkedinUrl);
  if (jobId) {
    linkedinUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
  } else {
    const canonicalLink = document.querySelector("link[rel='canonical']");
    if (canonicalLink && canonicalLink.href) linkedinUrl = canonicalLink.href;
  }

  const combinedDesc = [primaryDescription, tertiaryDescription].filter(Boolean).join(" · ");
  const missing = [];
  if (!rawTitle) missing.push("rawTitle");
  if (!rawCompany) missing.push("rawCompany");
  if (!rawContent || rawContent.length < 80) missing.push("rawContent");

  return {
    id: jobId ? `li-${jobId}` : undefined,
    linkedinJobId: jobId || null,
    rawTitle,
    rawCompany,
    companyLogo,
    rawContent,
    rawBadges,
    rawLocation: combinedDesc || primaryDescription || "",
    isEasyApply,
    applyType: isEasyApply ? "EASY_APPLY" : "EXTERNAL_APPLY",
    pageUrl: linkedinUrl,
    pageTitle: document.title,
    extractOk: missing.length === 0,
    missingFields: missing,
    timestamp: new Date().toISOString(),
    crawledAt: new Date().toISOString(),
  };
}
