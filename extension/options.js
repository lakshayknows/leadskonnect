const $ = (id) => document.getElementById(id);
let CFG = null; // last-loaded server config
let CAMPAIGNS = [];
let GROUPS = [];

function store() {
  return new Promise((r) => chrome.storage.local.get(["apiBase", "token"], r));
}
function banner(text, kind) {
  $("banner").innerHTML = text ? `<div class="banner ${kind === "err" ? "err" : "ok"}">${text}</div>` : "";
  if (text) setTimeout(() => ($("banner").innerHTML = ""), 4000);
}
async function apiFetch(path, opts = {}) {
  const { apiBase, token } = await store();
  const res = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.data;
}

function campaignRow(c) {
  const s = (CFG.campaignSettings || {})[c.id] || {};
  const selected = !CFG.selectedCampaignIds?.length || CFG.selectedCampaignIds.includes(c.id);
  return `
    <div class="camp" data-id="${c.id}">
      <div class="camp-head">
        <input type="checkbox" class="c-sel" ${selected ? "checked" : ""} />
        <span class="name">${c.name}</span>
        <span class="pill">${c.status}</span>
      </div>
      <div class="camp-cfg">
        <div><label>Cap/day</label><input class="c-cap" type="number" min="1" max="100" value="${s.cap ?? ""}" placeholder="global" /></div>
        <div><label>Action</label>
          <select class="c-mode">
            <option value="" ${!s.mode ? "selected" : ""}>Default</option>
            <option value="auto" ${s.mode === "auto" ? "selected" : ""}>Auto</option>
            <option value="invite" ${s.mode === "invite" ? "selected" : ""}>Invite</option>
            <option value="message" ${s.mode === "message" ? "selected" : ""}>Message</option>
          </select>
        </div>
      </div>
    </div>`;
}

function render() {
  $("cap").value = CFG.dailyInviteCap;
  $("minD").value = CFG.minDelaySec;
  $("maxD").value = CFG.maxDelaySec;
  $("mode").value = CFG.mode || "auto";
  $("campaigns").innerHTML = CAMPAIGNS.length
    ? CAMPAIGNS.map(campaignRow).join("")
    : `<p class="muted">No campaigns yet — create one in the app first.</p>`;
  $("runGroup").innerHTML = GROUPS.length
    ? GROUPS.map((g) => `<option value="${g.id}">${g.name}</option>`).join("")
    : `<option value="">No groups yet</option>`;
  const q = CFG.queue || {};
  $("queueInfo").textContent = `Queued ${q.pending ?? 0} · sent today ${q.sentToday ?? 0}`;
  const seen = CFG.lastSeenAt ? new Date(CFG.lastSeenAt) : null;
  const connected = seen && Date.now() - seen.getTime() < 15 * 60 * 1000;
  $("connStatus").textContent = connected ? "Connected — extension is polling." : "Token saved. Start the extension from its popup.";
  $("config").classList.remove("hide");
}

async function loadConfig() {
  const { apiBase, token } = await store();
  if (!apiBase || !token) { $("connStatus").textContent = "Enter your App URL + token, then Connect."; return; }
  try {
    const data = await apiFetch("/api/linkedin/config");
    CFG = data;
    CAMPAIGNS = data.campaigns || [];
    GROUPS = data.groups || [];
    render();
  } catch (e) {
    $("config").classList.add("hide");
    banner(`Couldn't load config: ${e.message}`, "err");
  }
}

function collectCampaignSettings() {
  const selectedCampaignIds = [];
  const campaignSettings = {};
  document.querySelectorAll(".camp").forEach((el) => {
    const id = el.dataset.id;
    if (el.querySelector(".c-sel").checked) selectedCampaignIds.push(id);
    const cap = el.querySelector(".c-cap").value;
    const mode = el.querySelector(".c-mode").value;
    const s = {};
    if (cap) s.cap = Number(cap);
    if (mode) s.mode = mode;
    if (Object.keys(s).length) campaignSettings[id] = s;
  });
  // "all ticked" and "none ticked" both mean run-all → store empty.
  const runAll = selectedCampaignIds.length === 0 || selectedCampaignIds.length === CAMPAIGNS.length;
  return { selectedCampaignIds: runAll ? [] : selectedCampaignIds, campaignSettings };
}

$("connect").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  await new Promise((r) => chrome.storage.local.set({ apiBase, token }, r));
  banner("Connected.", "ok");
  loadConfig();
});

$("save").addEventListener("click", async () => {
  const { selectedCampaignIds, campaignSettings } = collectCampaignSettings();
  try {
    await apiFetch("/api/linkedin/config", {
      method: "PUT",
      body: JSON.stringify({
        selectedCampaignIds,
        campaignSettings,
        mode: $("mode").value,
        dailyInviteCap: Number($("cap").value),
        minDelaySec: Number($("minD").value),
        maxDelaySec: Number($("maxD").value),
      }),
    });
    banner("Settings saved.", "ok");
    loadConfig();
  } catch (e) {
    banner(e.message, "err");
  }
});

$("run").addEventListener("click", async () => {
  const segmentId = $("runGroup").value;
  if (!segmentId) return banner("Pick a group first.", "err");
  try {
    const res = await apiFetch("/api/linkedin/run", {
      method: "POST",
      body: JSON.stringify({ segmentId, note: $("runNote").value.trim() || undefined, type: $("runType").value }),
    });
    banner(`Queued ${res.queued} action(s)${res.skipped ? `, skipped ${res.skipped} without a LinkedIn URL` : ""}.`, "ok");
    loadConfig();
  } catch (e) {
    banner(e.message, "err");
  }
});

(async function init() {
  const { apiBase, token } = await store();
  $("apiBase").value = apiBase || "https://www.followthroo.com";
  $("token").value = token || "";
  loadConfig();
})();
