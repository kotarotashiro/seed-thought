const endpointInput = document.getElementById("endpoint");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

async function load() {
  const { endpoint, token } = await chrome.storage.local.get(["endpoint", "token"]);
  if (endpoint) endpointInput.value = endpoint;
  if (token) tokenInput.value = token;
}

load();

saveBtn.addEventListener("click", async () => {
  const endpoint = endpointInput.value.trim().replace(/\/$/, "");
  const token = tokenInput.value.trim();
  await chrome.storage.local.set({ endpoint, token });
  statusEl.textContent = "保存しました ✓";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
});
