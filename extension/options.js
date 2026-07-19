const endpointInput = document.getElementById("endpoint");
const tokenInput = document.getElementById("token");
const autoEnabledInput = document.getElementById("x-article-auto-enabled");
const intervalInput = document.getElementById("x-article-interval");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const VALID_INTERVALS = ["15", "30", "60"];

async function load() {
  const stored = await chrome.storage.local.get([
    "endpoint",
    "token",
    "xArticleAutoEnabled",
    "xArticleIntervalMinutes",
  ]);
  if (stored.endpoint) endpointInput.value = stored.endpoint;
  if (stored.token) tokenInput.value = stored.token;
  autoEnabledInput.checked = stored.xArticleAutoEnabled !== false;
  const interval = String(stored.xArticleIntervalMinutes || "30");
  intervalInput.value = VALID_INTERVALS.includes(interval) ? interval : "30";
}

void load();

saveBtn.addEventListener("click", async () => {
  const endpoint = endpointInput.value.trim().replace(/\/$/, "");
  const token = tokenInput.value.trim();
  const interval = VALID_INTERVALS.includes(intervalInput.value) ? Number(intervalInput.value) : 30;

  await chrome.storage.local.set({
    endpoint,
    token,
    xArticleAutoEnabled: autoEnabledInput.checked,
    xArticleIntervalMinutes: interval,
  });
  try {
    await chrome.runtime.sendMessage({ type: "sync-x-article-alarm" });
  } catch (error) {
    console.warn("[SeedThought] Could not sync X Article alarm:", error);
  }
  statusEl.textContent = "保存しました ✓";
  setTimeout(() => { statusEl.textContent = ""; }, 2000);
});