const $ = (id) => document.getElementById(id);
const POLL_ALARM = "ft-linkedin-poll"; // must match background.js — no shared module between contexts

function render(cfg) {
  const on = !!cfg.enabled;
  $("toggle").textContent = on ? "Stop" : "Start";
  $("toggle").classList.toggle("on", on);
  $("dot").classList.toggle("on", on && !!cfg.token && !cfg.lastStatusError);

  const s = cfg.stats;
  const today = s && s.day === new Date().toDateString() ? s : { sent: 0, failed: 0, skipped: 0 };
  const counts = `Today: <b>${today.sent || 0}</b> sent · ${today.skipped || 0} skipped · ${today.failed || 0} failed`;

  const draftEl = $("draft");
  if (cfg.draft) {
    draftEl.style.display = "block";
    $("draftKind").textContent = cfg.draft.kind === "invite" ? "Invite" : "Message";
    $("draftWho").textContent = cfg.draft.leadName || cfg.draft.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "");
    $("draftNote").textContent = cfg.draft.note || "(no note text)";
  } else {
    draftEl.style.display = "none";
  }

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
  chrome.storage.local.get(["token", "enabled", "stats", "lastStatus", "lastStatusError", "draft", "apiBase"], render);
}

/** The human's verdict on a drafted action — reports the terminal outcome, closes the
 *  reviewed tab, clears local draft state, and resumes polling for the next one. */
async function resolveDraft(status) {
  const { apiBase, token, draft, stats } = await new Promise((r) =>
    chrome.storage.local.get(["apiBase", "token", "draft", "stats"], r)
  );
  if (!draft) return;

  try {
    await fetch(`${apiBase}/api/linkedin/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: draft.actionId, status }),
    });
  } catch {
    // Best-effort: the action stays "drafted" server-side and the stale-reclaim will
    // eventually revert it to pending rather than silently losing it.
  }

  if (draft.tabId) chrome.tabs.remove(draft.tabId).catch(() => {});

  const today = new Date().toDateString();
  const s = stats && stats.day === today ? stats : { day: today, sent: 0, failed: 0, skipped: 0 };
  s[status] = (s[status] || 0) + 1;
  s.lastAt = Date.now();

  await chrome.storage.local.set({ draft: null, stats: s, lastStatus: `you marked it ${status}`, lastStatusError: false });
  chrome.alarms.create(POLL_ALARM, { when: Date.now() + 2000 }); // resume polling for the next action
}

$("toggle").addEventListener("click", () => {
  chrome.storage.local.get(["enabled"], ({ enabled }) => chrome.storage.local.set({ enabled: !enabled }, load));
});
$("draftSent").addEventListener("click", () => resolveDraft("sent"));
$("draftSkip").addEventListener("click", () => resolveDraft("skipped"));
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
