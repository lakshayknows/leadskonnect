/**
 * Followthroo LinkedIn Assistant — background service worker.
 *
 * On a paced alarm it: polls the app for ONE queued action, opens the target profile in a
 * background tab, performs the invite/message via an injected script, reports the result,
 * then schedules the next tick at a humanized delay. One action per tick keeps it well
 * under LinkedIn's radar and survives the MV3 service-worker lifecycle.
 *
 * Every step logs to the service-worker console AND stores `lastStatus` (shown in the
 * popup) so "nothing happened" always has a visible reason.
 */
const POLL_ALARM = "ft-linkedin-poll";

function cfg() {
  return new Promise((r) => chrome.storage.local.get(["apiBase", "token", "enabled", "stats"], r));
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

async function runAction(action) {
  let tab;
  try {
    setStatus(`opening ${action.linkedinUrl}`);
    tab = await chrome.tabs.create({ url: action.linkedinUrl, active: false });
    await waitForTab(tab.id);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: performLinkedInAction,
      args: [action],
    });
    return res?.result || { status: "failed", result: "no result from page" };
  } catch (e) {
    return { status: "failed", result: String((e && e.message) || e) };
  } finally {
    if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function pollOnce() {
  const { apiBase, token, enabled, stats } = await cfg();
  if (!enabled) return setStatus("paused — press Start in the popup");
  if (!token || !apiBase) return setStatus("not configured — set App URL + token, then Save", true);

  // Guard the most common misconfig: the apex redirects to www and drops the auth header.
  if (/^https?:\/\/followthroo\.com/i.test(apiBase)) {
    return setStatus('App URL must be "https://www.followthroo.com" (with www), not the apex', true);
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

  const outcome = await runAction(action);
  try {
    await fetch(`${apiBase}/api/linkedin/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: action.id, status: outcome.status, result: outcome.result }),
    });
  } catch { /* reconciled on the next poll */ }

  const today = new Date().toDateString();
  const s = stats && stats.day === today ? stats : { day: today, sent: 0, failed: 0, skipped: 0 };
  s[outcome.status] = (s[outcome.status] || 0) + 1;
  s.lastAt = Date.now();
  chrome.storage.local.set({ stats: s });
  setStatus(`action ${outcome.status}: ${outcome.result}`, outcome.status === "failed");

  const delay = pacing.minDelaySec + Math.random() * (pacing.maxDelaySec - pacing.minDelaySec);
  schedule(delay);
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === POLL_ALARM) pollOnce(); });
chrome.runtime.onInstalled.addListener(() => { setStatus("installed"); schedule(5); });
chrome.runtime.onStartup.addListener(() => schedule(5));
chrome.storage.onChanged.addListener((ch) => { if (ch.enabled && ch.enabled.newValue) { setStatus("started"); schedule(3); } });

/**
 * Injected into the LinkedIn profile page. Best-effort DOM automation — LinkedIn changes
 * its markup often, so selectors are defensive and every path reports a clear outcome.
 */
async function performLinkedInAction(action) {
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

  async function sendMessage() {
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
    await sleep(900);
    const send = all("button").find((b) => /^Send$/i.test((b.textContent || "").trim()) && !b.disabled);
    if (!send) return { status: "failed", result: "Send button not found" };
    send.click();
    await sleep(1400);
    return { status: "sent", result: "message sent" };
  }

  async function sendInvite() {
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
      if (ta) { ta.focus(); ta.value = note; ta.dispatchEvent(new Event("input", { bubbles: true })); await sleep(600); }
    }
    const send = all("button").find(
      (b) => /^(Send|Send invitation|Send now|Send without a note)$/i.test(((b.getAttribute("aria-label") || b.textContent || "").trim())) && !b.disabled
    );
    if (!send) return { status: "failed", result: "Send invitation button not found" };
    send.click();
    await sleep(1400);
    return { status: "sent", result: "invitation sent" };
  }

  try {
    if (pending) return { status: "skipped", result: "invite already pending" };
    if (action.type === "message") return await sendMessage();
    const invited = await sendInvite();
    if (invited) return invited;
    if (messageBtn) return await sendMessage(); // already connected → message instead
    return { status: "skipped", result: "no Connect or Message action available" };
  } catch (e) {
    return { status: "failed", result: String((e && e.message) || e) };
  }
}
