// X Article DOM extraction helper for manual/debug execution.
// The background service worker injects an equivalent self-contained function.

const MIN_BODY_LENGTH = 30;
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

(function () {
  const pageText = compactText(document.body?.innerText || "");
  const pageTitle = document.title || "";
  if (
    /(^|\n)(ログイン|Sign in|Log in)(\s|$)/i.test(pageText) ||
    /(ログイン|Sign in|Log in)/i.test(pageTitle)
  ) {
    throw new Error("login page shown — not authenticated");
  }

  const title =
    ogMeta("og:title") ??
    document.querySelector("h1")?.innerText?.trim() ??
    pageTitle.replace(/\s*[|\-–—].*$/, "").trim() ??
    null;

  let body = null;
  for (const selector of ARTICLE_SELECTORS) {
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
    const clone = document.body.cloneNode(true);
    removeNoise(clone);
    const text = compactText(clone.innerText || "");
    if (text.length >= MIN_BODY_LENGTH) body = text;
  }

  if (!body || body.length < MIN_BODY_LENGTH) {
    throw new Error(`X Article body too short (${body?.length ?? 0} chars)`);
  }
  return { title, body };
})();