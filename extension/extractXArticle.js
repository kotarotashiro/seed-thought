// X Article DOM extraction — runs via chrome.scripting.executeScript in page context.
// Selector order: article element → OG tags → document.title.
// Returns { title: string|null, body: string } or throws if body < 100 chars.

const ARTICLE_SELECTORS = [
  "[data-testid='article']",
  "article",
  "[role='article']",
  "main",
  "[role='main']",
];

const NOISE_RE = /^(Follow|Following|Subscribe|Like|Reply|Retweet|Share|More|···|\.{3}|@\w+\s*·)$/im;

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

function extractTitle() {
  return (
    ogMeta("og:title") ??
    document.querySelector("h1")?.innerText?.trim() ??
    document.title?.replace(/\s*[|\-–—].*$/, "").trim() ??
    null
  );
}

function extractBody() {
  for (const sel of ARTICLE_SELECTORS) {
    const el = document.querySelector(sel);
    if (!el) continue;

    // Filter out nav/aside/footer inside the article container
    const clone = el.cloneNode(true);
    for (const noise of clone.querySelectorAll("nav, aside, footer, [aria-label='Trending'], [data-testid='sidebarColumn']")) {
      noise.remove();
    }

    const text = compactText(clone.innerText || "");
    if (text.length >= 100) return text;
  }

  // OG description fallback
  const ogDesc = ogMeta("og:description");
  if (ogDesc && ogDesc.length >= 100) return ogDesc;

  return null;
}

(function () {
  const title = extractTitle();
  const body = extractBody();
  if (!body || body.length < 100) {
    throw new Error(`X Article body too short (${body?.length ?? 0} chars) — page may still be loading`);
  }
  return { title, body };
})();
