// SeedThought Clipper — Manifest V3 service worker
// Handles the right-click context menu and the popup's send command.

const DEFAULT_ENDPOINT = "http://localhost:3003";
const STORAGE_KEYS = ["endpoint", "token"];

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  return {
    endpoint: (stored.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ""),
    token: stored.token || "",
  };
}

function extractFromPage() {
  const TRUNCATE = 8000;

  function clip(text) {
    const compact = (text || "").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").trim();
    return compact.length > TRUNCATE ? compact.slice(0, TRUNCATE) + "…" : compact;
  }

  const selection = (window.getSelection && window.getSelection().toString().trim()) || "";
  const article = document.querySelector("article, main, [role='main']");
  const fallbackEl = article || document.body;

  return {
    url: location.href,
    title: document.title || location.hostname,
    selection: clip(selection),
    content: clip(fallbackEl ? fallbackEl.innerText : ""),
  };
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title,
      message,
    });
  } catch (error) {
    console.log("[SeedThought]", title, message, error);
  }
}

async function clipTab(tab) {
  if (!tab || !tab.id) return;
  if (tab.url && /^chrome:\/\/|^chrome-extension:\/\/|^edge:\/\/|^about:/.test(tab.url)) {
    await notify("送信できません", "このページは拡張がアクセスできない種類です。");
    return;
  }

  let payload;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractFromPage,
    });
    payload = result;
  } catch (error) {
    await notify("送信できません", "ページ内容の取得に失敗しました: " + (error?.message || error));
    return;
  }

  if (!payload || (!payload.selection && !payload.content)) {
    await notify("送信できません", "ページ内容が空でした。");
    return;
  }

  const settings = await getSettings();
  if (!settings.endpoint) {
    await notify("送信先が未設定です", "拡張のオプションでSeedThoughtのURLを設定してください。");
    return;
  }

  const body = {
    source: "web",
    sourceUrl: payload.url,
    title: payload.title,
    content: payload.selection || payload.content,
    text: payload.selection
      ? `${payload.title}\n\n${payload.selection}\n\n${payload.url}`
      : `${payload.title}\n\n${payload.url}`,
  };

  try {
    const res = await fetch(settings.endpoint + "/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.token ? { "X-Extension-Token": settings.token } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => "")}`);
    await notify("SeedThoughtに保存しました", payload.title);
  } catch (error) {
    await notify("送信に失敗しました", error?.message || String(error));
  }
}

// ── X Article auto-fetch ──────────────────────────────────────────────────────
// The job is persisted in storage.local. Tab completion and chrome.alarms drive
// each state transition, so the service worker never relies on a long sleep.

const ARTICLE_ALARM = "x-article-poll";
const ARTICLE_STEP_ALARM = "x-article-step";
const ARTICLE_TIMEOUT_ALARM = "x-article-timeout";
const ARTICLE_POLL_OPTIONS = [15, 30, 60];
const ARTICLE_POLL_DEFAULT_MINUTES = 30;
const ARTICLE_BATCH_LIMIT = 3;
const ARTICLE_MIN_BODY_LENGTH = 30;
const ARTICLE_MAX_EXTRACTION_ATTEMPTS = 4;
const ARTICLE_RENDER_WAIT_MS = 5000;
const ARTICLE_RETRY_WAIT_MS = 3000;
const ARTICLE_NEXT_ITEM_MIN_MS = 5000;
const ARTICLE_NEXT_ITEM_MAX_MS = 10000;
const ARTICLE_TAB_TIMEOUT_MS = 30000;
const ARTICLE_FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ARTICLE_SETTINGS_KEYS = ["xArticleAutoEnabled", "xArticleIntervalMinutes"];
const ARTICLE_JOB_KEY = "xArticleJob";
const ARTICLE_FAILURES_KEY = "xArticleFailures";
const ARTICLE_FAILURE_STREAK_KEY = "xArticleFailureStreak";
const ARTICLE_FAILURE_NOTIFIED_KEY = "xArticleFailureNotified";

let articleJobRunnerActive = false;
const articleTabWaiters = new Map();

function extractXArticleFromPage() {
  // This function is injected into the X tab and must stay self-contained.
  const MIN_BODY_LENGTH = 30;

  function ogMeta(property) {
    const el =
      document.querySelector(`meta[property="${property}"]`) ??
      document.querySelector(`meta[name="${property}"]`);
    return el ? (el.getAttribute("content") || "").trim() || null : null;
  }

  function compactText(raw) {
    return (raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function removeNoise(clone) {
    for (const selector of [
      "nav", "aside", "footer", "header",
      "[data-testid='sidebarColumn']",
      "[data-testid='TopNavBar']",
      "[data-testid='AppTabBar']",
      "[aria-label='Trending']",
      "[aria-label='Follow']",
    ]) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }
  }

  const pageText = compactText(document.body?.innerText || "");
  const pageTitle = document.title || "";
  if (
    /(^|\n)(ログイン|Sign in|Log in)(\s|$)/i.test(pageText) ||
    /(ログイン|Sign in|Log in)/i.test(pageTitle)
  ) {
    return { ok: false, reason: "login page shown — not authenticated" };
  }

  const title =
    ogMeta("og:title") ??
    document.querySelector("h1")?.innerText?.trim() ??
    pageTitle.replace(/\s*[|\-–—].*$/, "").trim() ??
    null;

  const selectors = [
    "[data-testid='article']",
    "[data-testid='noteContent']",
    "[data-testid='articleBody']",
    "article",
    "[role='article']",
    "[data-testid='primaryColumn']",
    "main",
    "[role='main']",
  ];

  let body = null;
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const clone = element.cloneNode(true);
    removeNoise(clone);
    const text = compactText(clone.innerText || "");
    if (text.length >= MIN_BODY_LENGTH) {
      body = text;
      break;
    }
  }

  const ogDescription = ogMeta("og:description");
  if (!body && ogDescription && ogDescription.length >= MIN_BODY_LENGTH) body = ogDescription;

  if (!body && pageText.length >= MIN_BODY_LENGTH) {
    const bodyClone = document.body.cloneNode(true);
    removeNoise(bodyClone);
    const cleaned = compactText(bodyClone.innerText || "");
    if (cleaned.length >= MIN_BODY_LENGTH) body = cleaned;
  }

  const reason = `selectors tried: ${selectors.join(", ")} | title: ${title} | pageLen: ${pageText.length}`;
  if (!body || body.length < MIN_BODY_LENGTH) {
    return { ok: false, reason: `body too short (${body?.length ?? 0} chars). ${reason}` };
  }
  return { ok: true, title, body };
}

function normalizeArticleInterval(value) {
  const interval = Number(value);
  return ARTICLE_POLL_OPTIONS.includes(interval) ? interval : ARTICLE_POLL_DEFAULT_MINUTES;
}

async function getArticleSettings() {
  const stored = await chrome.storage.local.get(ARTICLE_SETTINGS_KEYS);
  return {
    enabled: stored.xArticleAutoEnabled !== false,
    intervalMinutes: normalizeArticleInterval(stored.xArticleIntervalMinutes),
  };
}

async function initializeArticleSettings() {
  const stored = await chrome.storage.local.get(ARTICLE_SETTINGS_KEYS);
  const defaults = {};
  if (typeof stored.xArticleAutoEnabled !== "boolean") defaults.xArticleAutoEnabled = true;
  if (!ARTICLE_POLL_OPTIONS.includes(Number(stored.xArticleIntervalMinutes))) {
    defaults.xArticleIntervalMinutes = ARTICLE_POLL_DEFAULT_MINUTES;
  }
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
}

async function syncArticleAlarm() {
  const settings = await getArticleSettings();
  await chrome.alarms.clear(ARTICLE_ALARM);
  if (settings.enabled) {
    await chrome.alarms.create(ARTICLE_ALARM, { periodInMinutes: settings.intervalMinutes });
  }
}

async function scheduleArticleStep(delayMs) {
  await chrome.alarms.clear(ARTICLE_STEP_ALARM);
  await chrome.alarms.create(ARTICLE_STEP_ALARM, { when: Date.now() + delayMs });
}

async function scheduleArticleTimeout() {
  await chrome.alarms.clear(ARTICLE_TIMEOUT_ALARM);
  await chrome.alarms.create(ARTICLE_TIMEOUT_ALARM, { when: Date.now() + ARTICLE_TAB_TIMEOUT_MS });
}

function randomItemDelay() {
  return ARTICLE_NEXT_ITEM_MIN_MS +
    Math.floor(Math.random() * (ARTICLE_NEXT_ITEM_MAX_MS - ARTICLE_NEXT_ITEM_MIN_MS + 1));
}

async function getActiveArticleFailures(now = Date.now()) {
  const stored = await chrome.storage.local.get(ARTICLE_FAILURES_KEY);
  const records = stored[ARTICLE_FAILURES_KEY] || {};
  const active = {};
  let changed = false;

  for (const [url, record] of Object.entries(records)) {
    if (record && Number(record.failedAt) + ARTICLE_FAILURE_COOLDOWN_MS > now) {
      active[url] = record;
    } else {
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ [ARTICLE_FAILURES_KEY]: active });
  return active;
}

async function recordArticleFailure(articleUrl, reason) {
  const records = await getActiveArticleFailures();
  records[articleUrl] = {
    failedAt: Date.now(),
    reason: String(reason || "unknown").slice(0, 300),
  };
  await chrome.storage.local.set({ [ARTICLE_FAILURES_KEY]: records });
}

async function fetchPendingArticles(settings) {
  const res = await fetch(
    `${settings.endpoint}/api/x/article-body?limit=${ARTICLE_BATCH_LIMIT}`,
    { headers: settings.token ? { "X-Extension-Token": settings.token } : {} },
  );
  if (!res.ok) throw new Error(`GET article-body failed: HTTP ${res.status}`);

  const payload = await res.json();
  const items = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(items)) return [];

  const failures = await getActiveArticleFailures();
  return items
    .filter((item) => item?.postId && typeof item.articleUrl === "string" && item.articleUrl)
    .filter((item) => !failures[item.articleUrl])
    .slice(0, ARTICLE_BATCH_LIMIT);
}

async function loadArticleJob() {
  const stored = await chrome.storage.local.get(ARTICLE_JOB_KEY);
  return stored[ARTICLE_JOB_KEY] || null;
}

async function saveArticleJob(job) {
  await chrome.storage.local.set({ [ARTICLE_JOB_KEY]: job });
}

async function clearArticleAlarm(name) {
  try { await chrome.alarms.clear(name); } catch {}
}

async function closeArticleTab(tabId) {
  if (!tabId) return;
  const waiter = articleTabWaiters.get(tabId);
  if (waiter) {
    chrome.tabs.onUpdated.removeListener(waiter);
    articleTabWaiters.delete(tabId);
  }
  try { await chrome.tabs.remove(tabId); } catch {}
}

async function finishArticleCycle(job) {
  await chrome.storage.local.remove(ARTICLE_JOB_KEY);
  await clearArticleAlarm(ARTICLE_STEP_ALARM);
  await clearArticleAlarm(ARTICLE_TIMEOUT_ALARM);

  const allFailed = job.items.length > 0 && job.successCount === 0;
  const stored = await chrome.storage.local.get([
    ARTICLE_FAILURE_STREAK_KEY,
    ARTICLE_FAILURE_NOTIFIED_KEY,
  ]);

  if (allFailed) {
    const alreadyNotified = stored[ARTICLE_FAILURE_NOTIFIED_KEY] === true;
    await chrome.storage.local.set({
      [ARTICLE_FAILURE_STREAK_KEY]: Number(stored[ARTICLE_FAILURE_STREAK_KEY] || 0) + 1,
      [ARTICLE_FAILURE_NOTIFIED_KEY]: true,
    });
    if (!alreadyNotified) {
      await notify(
        "X Article自動取得に失敗しました",
        `${job.items.length}件すべての本文取得に失敗しました。ログイン状態と拡張設定を確認してください。`,
      );
    }
    return;
  }

  await chrome.storage.local.set({
    [ARTICLE_FAILURE_STREAK_KEY]: 0,
    [ARTICLE_FAILURE_NOTIFIED_KEY]: false,
  });
}

async function finishCurrentArticle(job, { success, cooldown, reason }) {
  const item = job.items[job.index];
  await closeArticleTab(job.tabId);
  await clearArticleAlarm(ARTICLE_TIMEOUT_ALARM);
  if (cooldown && item?.articleUrl) await recordArticleFailure(item.articleUrl, reason);

  const nextJob = {
    ...job,
    index: job.index + 1,
    tabId: null,
    stage: "between-items",
    attempt: 0,
    result: null,
    successCount: job.successCount + (success ? 1 : 0),
    failureCount: job.failureCount + (success ? 0 : 1),
  };

  if (nextJob.index >= nextJob.items.length) {
    await finishArticleCycle(nextJob);
    return;
  }

  await saveArticleJob(nextJob);
  await scheduleArticleStep(randomItemDelay());
}

async function failCurrentArticle(job, reason, cooldown = true) {
  console.warn("[SeedThought] X Article processing failed:", job.items[job.index]?.articleUrl, reason);
  await finishCurrentArticle(job, { success: false, cooldown, reason });
}

async function openCurrentArticle(job) {
  const item = job.items[job.index];
  if (!item?.articleUrl) {
    await failCurrentArticle(job, "articleUrl is missing");
    return;
  }

  const openingJob = { ...job, stage: "opening" };
  await saveArticleJob(openingJob);
  try {
    const tab = await chrome.tabs.create({ url: item.articleUrl, active: false });
    if (!tab?.id) throw new Error("Chrome did not return an Article tab id");
    const loadingJob = { ...openingJob, stage: "loading", tabId: tab.id };
    await saveArticleJob(loadingJob);
    await waitForArticleTab(tab.id);
  } catch (error) {
    await failCurrentArticle(openingJob, error?.message || String(error));
  }
}

async function handleArticleTabComplete(tabId) {
  const job = await loadArticleJob();
  if (!job || job.stage !== "loading" || job.tabId !== tabId) return;
  await clearArticleAlarm(ARTICLE_TIMEOUT_ALARM);
  await saveArticleJob({ ...job, stage: "render-wait" });
  await scheduleArticleStep(ARTICLE_RENDER_WAIT_MS);
}

async function waitForArticleTab(tabId) {
  if (!tabId || articleTabWaiters.has(tabId)) return;

  const listener = (updatedTabId, changeInfo) => {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(listener);
    articleTabWaiters.delete(tabId);
    void handleArticleTabComplete(tabId).catch((error) => {
      console.warn("[SeedThought] Article tab completion handling failed:", error);
    });
  };
  articleTabWaiters.set(tabId, listener);
  chrome.tabs.onUpdated.addListener(listener);

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      articleTabWaiters.delete(tabId);
      await handleArticleTabComplete(tabId);
    } else {
      await scheduleArticleTimeout();
    }
  } catch (error) {
    chrome.tabs.onUpdated.removeListener(listener);
    articleTabWaiters.delete(tabId);
    const job = await loadArticleJob();
    if (job?.tabId === tabId) await failCurrentArticle(job, error?.message || String(error));
  }
}

async function attemptArticleExtraction(job) {
  if (!job.tabId) {
    await failCurrentArticle(job, "Article tab id is missing");
    return;
  }

  const attempt = job.attempt + 1;
  const extractingJob = { ...job, stage: "extracting", attempt };
  await saveArticleJob(extractingJob);

  let result;
  try {
    const [{ result: extracted }] = await chrome.scripting.executeScript({
      target: { tabId: job.tabId },
      func: extractXArticleFromPage,
    });
    result = extracted;
  } catch (error) {
    result = { ok: false, reason: error?.message || String(error) };
  }

  if (result?.ok && typeof result.body === "string" && result.body.length >= ARTICLE_MIN_BODY_LENGTH) {
    const postingJob = {
      ...extractingJob,
      stage: "posting",
      result: { title: result.title ?? null, body: result.body },
    };
    await saveArticleJob(postingJob);
    await postCurrentArticle(postingJob);
    return;
  }

  console.log(
    `[SeedThought] X Article extraction attempt ${attempt}/${ARTICLE_MAX_EXTRACTION_ATTEMPTS}:`,
    result?.reason || "body too short",
  );
  if (attempt < ARTICLE_MAX_EXTRACTION_ATTEMPTS) {
    await saveArticleJob({ ...extractingJob, stage: "extract-retry" });
    await scheduleArticleStep(ARTICLE_RETRY_WAIT_MS);
  } else {
    await failCurrentArticle(job, result?.reason || "body too short");
  }
}

async function postCurrentArticle(job) {
  const settings = await getSettings();
  const item = job.items[job.index];
  if (!job.result?.body || !item) {
    await failCurrentArticle(job, "Article extraction result is missing");
    return;
  }

  try {
    const res = await fetch(`${settings.endpoint}/api/x/article-body`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.token ? { "X-Extension-Token": settings.token } : {}),
      },
      body: JSON.stringify({
        postId: item.postId,
        articleUrl: item.articleUrl,
        title: job.result.title,
        body: job.result.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST article-body failed: HTTP ${res.status} ${text}`.trim());
    }
    await finishCurrentArticle(job, { success: true, cooldown: false });
  } catch (error) {
    console.warn("[SeedThought] POST article-body failed:", error);
    await finishCurrentArticle(job, {
      success: false,
      cooldown: false,
      reason: error?.message || String(error),
    });
  }
}

async function resumeArticleJob(existingJob = null) {
  if (articleJobRunnerActive) return;
  articleJobRunnerActive = true;
  try {
    const job = existingJob || await loadArticleJob();
    if (!job) return;

    switch (job.stage) {
      case "opening":
      case "between-items":
        await openCurrentArticle({ ...job, stage: "opening" });
        break;
      case "loading":
        await waitForArticleTab(job.tabId);
        break;
      case "render-wait":
      case "extract-retry":
      case "extracting":
        await attemptArticleExtraction(job);
        break;
      case "posting":
        await postCurrentArticle(job);
        break;
      default:
        await failCurrentArticle(job, `Unknown Article job stage: ${job.stage}`);
    }
  } catch (error) {
    console.warn("[SeedThought] X Article job resume failed:", error);
    const job = await loadArticleJob();
    if (job) await failCurrentArticle(job, error?.message || String(error));
  } finally {
    articleJobRunnerActive = false;
  }
}

async function fetchPendingArticleCycle({ force = false } = {}) {
  const settings = await getArticleSettings();
  if (!force && !settings.enabled) return { started: false, reason: "disabled" };

  const currentJob = await loadArticleJob();
  if (currentJob) {
    void resumeArticleJob(currentJob);
    return { started: false, reason: "busy" };
  }

  let items;
  try {
    items = await fetchPendingArticles(settings);
  } catch (error) {
    console.warn("[SeedThought] X Article poll failed:", error);
    return { started: false, reason: "poll-failed" };
  }
  if (items.length === 0) return { started: false, reason: "empty" };

  const job = {
    items,
    index: 0,
    tabId: null,
    stage: "opening",
    attempt: 0,
    result: null,
    successCount: 0,
    failureCount: 0,
  };
  await saveArticleJob(job);
  void resumeArticleJob(job);
  return { started: true, count: items.length };
}

async function handleArticleTimeout() {
  const job = await loadArticleJob();
  if (!job || job.stage !== "loading" || !job.tabId) return;

  try {
    const tab = await chrome.tabs.get(job.tabId);
    if (tab.status === "complete") {
      await handleArticleTabComplete(job.tabId);
      return;
    }
  } catch {}
  await failCurrentArticle(job, `Article tab timed out after ${ARTICLE_TAB_TIMEOUT_MS}ms`);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ARTICLE_ALARM) {
    void fetchPendingArticleCycle().catch((error) => console.warn("[SeedThought] Article poll failed:", error));
  } else if (alarm.name === ARTICLE_STEP_ALARM) {
    void resumeArticleJob().catch((error) => console.warn("[SeedThought] Article step failed:", error));
  } else if (alarm.name === ARTICLE_TIMEOUT_ALARM) {
    void handleArticleTimeout().catch((error) => console.warn("[SeedThought] Article timeout failed:", error));
  }
});

async function initializeExtension() {
  await initializeArticleSettings();
  await syncArticleAlarm();
  await resumeArticleJob();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "send-to-seedthought",
      title: "SeedThoughtに送る",
      contexts: ["page", "selection", "link"],
    });
  });
  void initializeExtension().catch((error) => console.warn("[SeedThought] Initialization failed:", error));
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtension().catch((error) => console.warn("[SeedThought] Startup failed:", error));
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "send-to-seedthought") await clipTab(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "clip-active-tab") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await clipTab(tab);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "fetch-x-articles") {
    (async () => {
      try {
        sendResponse({ ok: true, ...(await fetchPendingArticleCycle({ force: true })) });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "sync-x-article-alarm") {
    (async () => {
      try {
        await syncArticleAlarm();
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }
});