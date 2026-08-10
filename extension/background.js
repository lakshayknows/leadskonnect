/**
 * Followthroo LinkedIn Assistant — background service worker.
 *
 * On a paced alarm it: polls the app for ONE queued action, opens the target profile in a
 * FOREGROUNDED tab, fills the invite note / message box via an injected script, and STOPS —
 * it never clicks Send. A real person reviews what was filled and sends it themselves inside
 * their own LinkedIn tab, then confirms (or skips) from the popup. That confirmation is what
 * reports the outcome back to the app; nothing here acts autonomously past the draft.
 *
 * While a draft is awaiting review, polling pauses (one action in flight at a time — no
 * stacking foregrounded tabs). It resumes once the popup reports sent/skipped.
 *
 * Every step logs to the service-worker console AND stores `lastStatus` (shown in the
 * popup) so "nothing happened" always has a visible reason.
 */
const POLL_ALARM = "ft-linkedin-poll";

function cfg() {
  return new Promise((r) => chrome.storage.local.get(["apiBase", "token", "enabled", "stats", "draft"], r));
}
function setStatus(msg, isError) {
  console.log(`[followthroo] ${msg}`);
  chrome.storage.local.set({ lastStatus: msg, lastStatusAt: Date.now(), lastStatusError: !!isError });
}
function schedule(sec) {
  chrome.alarms.create(POLL_ALARM, { when: Date.now() + Math.max(30, Math.round(sec)) * 1000 });
}
function waitForTab(tabId) {
  return new Promise((resolve) => {
    const to = setTimeout(finish, 25000);
    function finish() { clearTimeout(to); chrome.tabs.onUpdated.removeListener(l); setTimeout(resolve, 1800); }
    function l(id, info) { if (id === tabId && info.status === "complete") finish(); }
    chrome.tabs.onUpdated.addListener(l);
  });
}

/** Opens the profile FOREGROUNDED and fills the note/message box. Never clicks Send. */
async function draftAction(action) {
  let tab;
  try {
    setStatus(`opening ${action.linkedinUrl} for review`);
    tab = await chrome.tabs.create({ url: action.linkedinUrl, active: true });
    await waitForTab(tab.id);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillLinkedInAction,
      args: [action],
    });
    const outcome = res?.result || { status: "failed", result: "no result from page" };
    return { ...outcome, tabId: tab.id };
  } catch (e) {
    return { status: "failed", result: String((e && e.message) || e), tabId: tab && tab.id };
  }
}

async function pollOnce() {
  const { apiBase, token, enabled, stats, draft } = await cfg();
  if (!enabled) return setStatus("paused — press Start in the popup");
  if (!token || !apiBase) return setStatus("not configured — set App URL + token, then Save", true);

  // A draft is already awaiting human review — don't open another tab on top of it.
  if (draft) return setStatus("awaiting your review — open the popup to confirm or skip");

  // Guard the most common misconfig: the wrong host has no queue endpoint behind it.
  if (!/^https?:\/\/(app\.followthroo\.com|localhost:3000|127\.0\.0\.1:3000)/i.test(apiBase)) {
    return setStatus('App URL should be "https://app.followthroo.com" (the product lives there, not on the marketing site)', true);
  }

  setStatus("polling for queued actions…");
  let data;
  try {
    const res = await fetch(`${apiBase}/api/linkedin/queue?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) return schedule(180), setStatus("token rejected (401) — copy a fresh token from Settings → LinkedIn", true);
    if (!res.ok || !j.ok) return schedule(180), setStatus(`server error ${res.status} — ${j.error || "unexpected response"}`, true);
    data = j.data;
  } catch (e) {
    schedule(180);
    return setStatus(`can't reach ${apiBase} (${String((e && e.message) || e)})`, true);
  }

  const pacing = data.pacing || { minDelaySec: 45, maxDelaySec: 120 };
  const action = (data.actions || [])[0];
  if (!action) {
    schedule(75);
    return setStatus("connected — queue is empty (add a LinkedIn campaign step + leads with a LinkedIn URL)");
  }

  const outcome = await draftAction(action);

  if (outcome.status === "drafted") {
    await chrome.storage.local.set({
      draft: {
        actionId: action.id,
        tabId: outcome.tabId,
        kind: outcome.kind,
        note: action.note,
        linkedinUrl: action.linkedinUrl,
        leadName: action.leadName || null,
      },
    });
    try {
      await fetch(`${apiBase}/api/linkedin/queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, status: "drafted" }),
      });
    } catch { /* best-effort — the server's own stale-reclaim covers a missed update */ }
    setStatus("drafted — review it in the LinkedIn tab, then confirm in this popup");
    return; // polling stays paused until the popup reports sent/skipped
  }

  // Nothing to review (already pending, no button found, not logged in, etc.) — this is a
  // terminal outcome with no human step, report it and move on exactly as before.
  if (outcome.tabId) chrome.tabs.remove(outcome.tabId).catch(() => {});
  try {
    await fetch(`${apiBase}/api/linkedin/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: action.id, status: outcome.status, result: outcome.result }),
    });
  } catch { /* reconciled on the next poll */ }

  recordStat(stats, outcome.status);
  setStatus(`action ${outcome.status}: ${outcome.result}`, outcome.status === "failed");

  const delay = pacing.minDelaySec + Math.random() * (pacing.maxDelaySec - pacing.minDelaySec);
  schedule(delay);
}

function recordStat(stats, status) {
  const today = new Date().toDateString();
  const s = stats && stats.day === today ? stats : { day: today, sent: 0, failed: 0, skipped: 0 };
  s[status] = (s[status] || 0) + 1;
  s.lastAt = Date.now();
  chrome.storage.local.set({ stats: s });
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === POLL_ALARM) pollOnce(); });
chrome.runtime.onInstalled.addListener(() => { setStatus("installed"); schedule(5); });
chrome.runtime.onStartup.addListener(() => schedule(5));
chrome.storage.onChanged.addListener((ch) => { if (ch.enabled && ch.enabled.newValue) { setStatus("started"); schedule(3); } });

/**
 * Injected into the LinkedIn profile page. Fills the invite note or message box and stops —
 * it never clicks Send. Best-effort DOM automation for the fill step only; LinkedIn changes
 * its markup often, so selectors are defensive and every path reports a clear outcome.
 */
async function fillLinkedInAction(action) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const all = (sel) => Array.from(document.querySelectorAll(sel));
  const btnByLabel = (re) =>
    all('button, a[role="button"]').find((b) => re.test(((b.getAttribute("aria-label") || b.textContent || "").trim())));

  // Bail early if LinkedIn bounced us to a login/checkpoint page.
  if (/\/(login|checkpoint|authwall)/.test(location.pathname) || document.querySelector('input[name="session_key"]')) {
    return { status: "failed", result: "not logged in to LinkedIn in this browser" };
  }

  await sleep(2500 + Math.random() * 2500); // let the profile settle

  const note = (action.note || "").slice(0, 300);
  const pending = btnByLabel(/pending/i);
  const messageBtn = btnByLabel(/^Message\b/i);

  async function fillMessage() {
    const mb = messageBtn || btnByLabel(/^Message\b/i);
    if (!mb) return { status: "skipped", result: "no Message button" };
    mb.click();
    await sleep(2800);
    const box = document.querySelector(
      '.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable, div[role="textbox"][contenteditable="true"]'
    );
    if (!box) return { status: "failed", result: "message box not found" };
    box.focus();
    document.execCommand("insertText", false, note || "Hi!");
    return { status: "drafted", result: "message drafted — review it and click Send yourself", kind: "message" };
  }

  async function fillInvite() {
    let connect = btnByLabel(/^(Connect|Invite)\b/i);
    if (!connect) {
      const more = btnByLabel(/^More\b/i);
      if (more) { more.click(); await sleep(1200); connect = btnByLabel(/^Connect\b/i); }
    }
    if (!connect) return null; // not invitable from here
    connect.click();
    await sleep(2200);
    const addNote = all("button").find((b) => /add a note/i.test((b.getAttribute("aria-label") || b.textContent || "")));
    if (note && addNote) {
      addNote.click();
      await sleep(1200);
      const ta = document.querySelector('textarea#custom-message, textarea[name="message"], textarea');
      if (ta) { ta.focus(); ta.value = note; ta.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    return { status: "drafted", result: "invitation drafted — review it and click Send yourself", kind: "invite" };
  }

  try {
    if (pending) return { status: "skipped", result: "invite already pending" };
    if (action.type === "message") return await fillMessage();
    const invited = await fillInvite();
    if (invited) return invited;
    if (messageBtn) return await fillMessage(); // already connected → message instead
    return { status: "skipped", result: "no Connect or Message action available" };
  } catch (e) {
    return { status: "failed", result: String((e && e.message) || e) };
  }
}
