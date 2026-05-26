// SeedThought Clipper — service worker
// Handles the right-click context menu and the popup's "send" command.

const DEFAULT_ENDPOINT = "http://localhost:3003";
const STORAGE_KEYS = ["endpoint", "token"];

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  return {
    endpoint: (stored.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ""),
    token: stored.token || "",
  };
}

// Extract the visible page content. Prefers selection, then <article>/<main>,
// then falls back to body innerText. Truncates so the payload stays sane.
function extractFromPage() {
  const TRUNCATE = 8000;

  function clip(text) {
    const compact = (text || "").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").trim();
    if (compact.length > TRUNCATE) return compact.slice(0, TRUNCATE) + "…";
    return compact;
  }

  const selection = (window.getSelection && window.getSelection().toString().trim()) || "";

  const article = document.querySelector("article, main, [role='main']");
  const fallbackEl = article || document.body;
  const body = fallbackEl ? fallbackEl.innerText : "";

  return {
    url: location.href,
    title: document.title || location.hostname,
    selection: clip(selection),
    content: clip(body),
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
  } catch (e) {
    // Some environments don't allow notifications without an iconUrl that exists.
    console.log("[SeedThought]", title, message);
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
  } catch (e) {
    await notify("送信できません", "ページ内容の取得に失敗しました: " + (e && e.message ? e.message : e));
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
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${errText}`);
    }
    await notify("SeedThoughtに保存しました", payload.title);
  } catch (e) {
    await notify("送信に失敗しました", e && e.message ? e.message : String(e));
  }
}

// ── X Article auto-fetch ──────────────────────────────────────────────────────

const ARTICLE_ALARM = "x-article-poll";
const ARTICLE_POLL_MINUTES = 5;

function extractXArticleFromPage() {
  // Inline — must be self-contained (no closures over outer scope).

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
    const noiseSelectors = [
      "nav", "aside", "footer", "header",
      "[data-testid='sidebarColumn']",
      "[data-testid='TopNavBar']",
      "[data-testid='AppTabBar']",
      "[aria-label='Trending']",
      "[aria-label='Follow']",
    ];
    for (const sel of noiseSelectors) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }
  }

  // Detect login/redirect page (article not accessible)
  const pageText = compactText(document.body?.innerText || "");
  const isLoginPage = /^(ログイン|Sign in|Log in)/.test(pageText) ||
    document.title.includes("ログイン") ||
    document.title.includes("Sign in");
  if (isLoginPage) {
    return { ok: false, reason: "login page shown — not authenticated" };
  }

  const title =
    ogMeta("og:title") ??
    document.querySelector("h1")?.innerText?.trim() ??
    document.title?.replace(/\s*[|\-–—].*$/, "").trim() ??
    null;

  // Try article-specific selectors first (X Notes / Article DOM)
  const ARTICLE_SELECTORS = [
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

  for (const sel of ARTICLE_SELECTORS) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const clone = el.cloneNode(true);
    removeNoise(clone);
    const text = compactText(clone.innerText || "");
    if (text.length >= 100) { body = text; break; }
  }

  // OG description fallback
  if (!body) {
    const ogDesc = ogMeta("og:description");
    if (ogDesc && ogDesc.length >= 100) body = ogDesc;
  }

  // Full body fallback (last resort)
  if (!body && pageText.length >= 100) {
    const bodyClone = document.body.cloneNode(true);
    removeNoise(bodyClone);
    const cleaned = compactText(bodyClone.innerText || "");
    if (cleaned.length >= 100) body = cleaned;
  }

  const reason = `selectors tried: ${ARTICLE_SELECTORS.join(", ")} | title: ${title} | pageLen: ${pageText.length}`;
  if (!body || body.length < 100) {
    return { ok: false, reason: `body too short (${body?.length ?? 0} chars). ${reason}` };
  }
  return { ok: true, title, body };
}

async function fetchXArticles() {
  const settings = await getSettings();
  if (!settings.endpoint) return;

  let items;
  try {
    const res = await fetch(`${settings.endpoint}/api/x/article-body?limit=5`, {
      headers: settings.token ? { "X-Extension-Token": settings.token } : {},
    });
    if (!res.ok) return;
    ({ items } = await res.json());
  } catch (e) {
    console.warn("[SeedThought] X Article poll failed:", e);
    return;
  }

  if (!Array.isArray(items) || items.length === 0) return;

  for (const { postId, articleUrl } of items) {
    await processOneArticle(settings, postId, articleUrl);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractWithRetry(tabId, maxAttempts = 4, intervalMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractXArticleFromPage,
      });
      if (result && result.ok) return result;
      console.log(`[SeedThought] attempt ${attempt}/${maxAttempts}: ${result?.reason ?? "no result"}`);
    } catch (e) {
      console.log(`[SeedThought] attempt ${attempt}/${maxAttempts} error:`, e.message);
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  return null;
}

async function processOneArticle(settings, postId, articleUrl) {
  let tabId;
  try {
    const tab = await chrome.tabs.create({ url: articleUrl, active: false });
    tabId = tab.id;

    await waitForTabComplete(tabId, 30_000);
    // Wait for SPA (React) to finish rendering article content after initial load
    await sleep(5000);

    const result = await extractWithRetry(tabId, 4, 3000);

    await chrome.tabs.remove(tabId);
    tabId = null;

    if (!result || !result.ok) {
      console.warn("[SeedThought] Extraction failed after all attempts for", articleUrl);
      return;
    }

    const res = await fetch(`${settings.endpoint}/api/x/article-body`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.token ? { "X-Extension-Token": settings.token } : {}),
      },
      body: JSON.stringify({ postId, title: result.title ?? null, body: result.body }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[SeedThought] POST article-body failed:", res.status, txt);
    }
  } catch (e) {
    console.warn("[SeedThought] processOneArticle error:", articleUrl, e);
    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${tabId} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ARTICLE_ALARM) fetchXArticles();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "send-to-seedthought",
      title: "SeedThoughtに送る",
      contexts: ["page", "selection", "link"],
    });
  });
  chrome.alarms.create(ARTICLE_ALARM, { periodInMinutes: ARTICLE_POLL_MINUTES });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "send-to-seedthought") {
    await clipTab(tab);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "clip-active-tab") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try {
        await clipTab(tab);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
      }
    })();
    return true;
  }

  if (message && message.type === "fetch-x-articles") {
    (async () => {
      try {
        await fetchXArticles();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
      }
    })();
    return true;
  }
});
