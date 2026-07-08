const $ = (id) => document.getElementById(id);

function render(cfg) {
  $("apiBase").value = cfg.apiBase || "https://www.followthroo.com";
  $("token").value = cfg.token || "";
  const on = !!cfg.enabled;
  $("toggle").textContent = on ? "Stop" : "Start";
  $("toggle").classList.toggle("on", on);
  $("dot").classList.toggle("on", on && !!cfg.token && !cfg.lastStatusError);

  const s = cfg.stats;
  const today = s && s.day === new Date().toDateString() ? s : { sent: 0, failed: 0, skipped: 0 };
  const counts = `Today: <b>${today.sent || 0}</b> sent · ${today.skipped || 0} skipped · ${today.failed || 0} failed`;

  const box = $("status");
  box.style.color = cfg.lastStatusError ? "#b91c1c" : "";
  if (!cfg.token) {
    box.textContent = "Not connected — paste your token and Save.";
  } else if (cfg.lastStatus) {
    box.innerHTML = `${cfg.lastStatus}<br><span style="color:#6b6b6b;font-size:11px">${counts}</span>`;
  } else if (on) {
    box.innerHTML = `Starting…<br><span style="color:#6b6b6b;font-size:11px">${counts}</span>`;
  } else {
    box.textContent = "Paused. Press Start to drain your queue.";
  }
}

function load() {
  chrome.storage.local.get(["apiBase", "token", "enabled", "stats", "lastStatus", "lastStatusError"], render);
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
