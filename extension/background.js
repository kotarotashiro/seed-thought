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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "send-to-seedthought",
      title: "SeedThoughtに送る",
      contexts: ["page", "selection", "link"],
    });
  });
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
    return true; // keep the message channel open for async response
  }
});
