const sendBtn = document.getElementById("send");
const fetchArticlesBtn = document.getElementById("fetch-articles");
const statusEl = document.getElementById("status");
const endpointEl = document.getElementById("endpoint-display");
const optionsLink = document.getElementById("open-options");

async function refreshEndpoint() {
  const { endpoint } = await chrome.storage.local.get(["endpoint"]);
  endpointEl.textContent = endpoint
    ? "送信先: " + endpoint
    : "送信先: 未設定（右上「設定」から指定）";
}

refreshEndpoint();

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

sendBtn.addEventListener("click", () => {
  statusEl.className = "status";
  statusEl.textContent = "送信中…";
  sendBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "clip-active-tab" }, (response) => {
    sendBtn.disabled = false;
    if (response && response.ok) {
      statusEl.className = "status ok";
      statusEl.textContent = "送信しました ✓";
    } else {
      statusEl.className = "status err";
      statusEl.textContent =
        "送信に失敗: " + ((response && response.error) || "不明なエラー");
    }
  });
});

fetchArticlesBtn.addEventListener("click", () => {
  statusEl.className = "status";
  statusEl.textContent = "X Article 取得中…";
  fetchArticlesBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "fetch-x-articles" }, (response) => {
    fetchArticlesBtn.disabled = false;
    if (response && response.ok) {
      statusEl.className = "status ok";
      statusEl.textContent = "X Article 取得完了 ✓";
    } else {
      statusEl.className = "status err";
      statusEl.textContent =
        "取得に失敗: " + ((response && response.error) || "不明なエラー");
    }
  });
});
