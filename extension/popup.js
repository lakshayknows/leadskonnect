const $ = (id) => document.getElementById(id);

function render(cfg) {
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
    box.textContent = "Not connected — open Settings to add your token.";
  } else if (cfg.lastStatus) {
    box.innerHTML = `${cfg.lastStatus}<br><span class="muted">${counts}</span>`;
  } else if (on) {
    box.innerHTML = `Starting…<br><span class="muted">${counts}</span>`;
  } else {
    box.textContent = "Paused. Press Start to drain your queue.";
  }
}

function load() {
  chrome.storage.local.get(["token", "enabled", "stats", "lastStatus", "lastStatusError"], render);
}

$("toggle").addEventListener("click", () => {
  chrome.storage.local.get(["enabled"], ({ enabled }) => chrome.storage.local.set({ enabled: !enabled }, load));
});
$("settings").addEventListener("click", () => {
  // Open the Options page reliably. openOptionsPage() can no-op if the manifest's
  // options_page wasn't reloaded, so fall back to opening the page URL directly.
  const url = chrome.runtime.getURL("options.html");
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) chrome.tabs.create({ url });
    });
  } else {
    chrome.tabs.create({ url });
  }
  window.close();
});

chrome.storage.onChanged.addListener(load);
load();
