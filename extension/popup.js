const $ = (id) => document.getElementById(id);

function render(cfg) {
  $("apiBase").value = cfg.apiBase || "https://www.followthroo.com";
  $("token").value = cfg.token || "";
  const on = !!cfg.enabled;
  $("toggle").textContent = on ? "Stop" : "Start";
  $("toggle").classList.toggle("on", on);
  $("dot").classList.toggle("on", on && !!cfg.token);

  const s = cfg.stats;
  if (on && cfg.token) {
    const done = s && s.day === new Date().toDateString() ? s : { sent: 0, failed: 0, skipped: 0 };
    $("status").innerHTML = `Running. Today: <b>${done.sent || 0}</b> sent · ${done.skipped || 0} skipped · ${done.failed || 0} failed.`;
  } else if (cfg.token) {
    $("status").textContent = "Paused. Press Start to drain your queue.";
  } else {
    $("status").textContent = "Not connected — paste your token and Save.";
  }
}

function load() {
  chrome.storage.local.get(["apiBase", "token", "enabled", "stats"], render);
}

$("save").addEventListener("click", () => {
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  chrome.storage.local.set({ apiBase, token }, load);
});

$("toggle").addEventListener("click", () => {
  chrome.storage.local.get(["enabled"], ({ enabled }) => {
    chrome.storage.local.set({ enabled: !enabled }, load);
  });
});

chrome.storage.onChanged.addListener(load);
load();
