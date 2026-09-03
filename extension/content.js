/**
 * The in-page bar on LinkedIn.
 *
 * Two ways into the same feature, for two different moments:
 *
 *   - You are in the app, you paste a URL, the extension opens a tab and reads
 *     it in bulk. Good for "give me the 500 people in this search".
 *   - You are already browsing LinkedIn, looking at real people, and you want
 *     *these four*. That is this file.
 *
 * The second is the one people reach for most, because it is what they are
 * already doing. It is also the honest one: you can see exactly who you picked,
 * so nothing arrives in the CRM that you did not look at.
 *
 * Design rules this follows:
 *   - Never obscure LinkedIn's own controls. The bar sits above the list, in
 *     flow, not floating over the page.
 *   - Look like us, not like LinkedIn. Somebody should never be confused about
 *     which product just added a checkbox to their screen.
 *   - Do nothing until asked. No selection is made for you, and the bar has one
 *     primary action.
 */
(() => {
  if (window.__ftBarLoaded) return; // survives LinkedIn's SPA re-renders
  window.__ftBarLoaded = true;

  const ACCENT = "#4B31E6";
  const BAR_ID = "ft-bar";
  const CHECK_CLASS = "ft-row-check";

  const state = { selected: new Map(), kind: null, busy: false };

  /* ---------------------------------------------------------------- */

  function styles() {
    if (document.getElementById("ft-style")) return;
    const el = document.createElement("style");
    el.id = "ft-style";
    el.textContent = `
      #${BAR_ID}{position:sticky;top:56px;z-index:400;display:flex;align-items:center;gap:14px;
        margin:0 0 12px;padding:10px 14px;border:1px solid #e5e5e5;border-radius:12px;
        background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06);
        font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;color:#0a0a0a}
      #${BAR_ID} .ft-brand{display:flex;align-items:center;gap:7px;font-weight:700;flex:0 0 auto}
      #${BAR_ID} .ft-mark{width:18px;height:18px;border-radius:5px;background:${ACCENT};color:#fff;
        display:grid;place-items:center;font-size:11px;font-weight:800}
      #${BAR_ID} .ft-sep{width:1px;height:20px;background:#e5e5e5;flex:0 0 auto}
      #${BAR_ID} .ft-count{color:#6b6b6b;flex:1 1 auto}
      #${BAR_ID} button{border:0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;
        cursor:pointer;font-family:inherit}
      #${BAR_ID} .ft-link{background:none;color:#6b6b6b;padding:8px 4px}
      #${BAR_ID} .ft-link:hover{color:#0a0a0a;text-decoration:underline}
      #${BAR_ID} .ft-primary{background:${ACCENT};color:#fff}
      #${BAR_ID} .ft-primary:disabled{opacity:.45;cursor:default}
      #${BAR_ID} .ft-msg{font-size:12px}
      #${BAR_ID} .ft-ok{color:#0f7b52}
      #${BAR_ID} .ft-err{color:#b91c1c}
      .${CHECK_CLASS}{position:absolute;left:-30px;top:22px;width:18px;height:18px;cursor:pointer;
        accent-color:${ACCENT};z-index:399}
      .ft-anchor{position:relative}
      @media (max-width:1200px){.${CHECK_CLASS}{left:6px;top:6px}}
    `;
    document.documentElement.appendChild(el);
  }

  /* ---------------------------------------------------------------- */

  /** Person cards, using the same selector list the bulk readers use. */
  function rowCards() {
    const selectors = [
      "li.reusable-search__result-container",
      "div.entity-result",
      "li.artdeco-list__item",
      ".scaffold-finite-scroll__content > ul > li",
    ];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel)).filter((el) =>
        el.querySelector('a[href*="/in/"]'),
      );
      if (found.length) return found;
    }
    return [];
  }

  /**
   * LinkedIn's own result count, e.g. "About 2,300 results".
   *
   * Needed because a search page shows about ten people, so a bar that can only
   * take what is on screen is a nice touch rather than a prospecting tool. This
   * is what lets us offer the whole set.
   */
  function totalResults() {
    const el = document.querySelector(".search-results-container h2, .pb2.t-black--light, .search-results__total");
    const m = el && el.textContent ? el.textContent.replace(/[,\s]/g, "").match(/(\d+)result/i) : null;
    return m ? Number(m[1]) : null;
  }

  function rowData(card) {
    const a = card.querySelector('a[href*="/in/"]');
    if (!a) return null;
    let profileUrl;
    try {
      const u = new URL(a.getAttribute("href"), "https://www.linkedin.com");
      profileUrl = `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return null;
    }
    const grab = (sels) => {
      for (const s of sels) {
        const n = card.querySelector(s);
        const t = n && n.textContent ? n.textContent.trim().replace(/\s+/g, " ") : "";
        if (t) return t;
      }
      return "";
    };
    const raw = grab([
      "span.entity-result__title-text span[aria-hidden='true']",
      ".entity-result__title-text a span",
      "span[dir='ltr'] span[aria-hidden='true']",
      ".artdeco-entity-lockup__title",
    ]);
    const degree = (raw.match(/\b(1st|2nd|3rd)\b/) || [])[1] || "";
    const fullName = raw.replace(/\b(1st|2nd|3rd)\b/g, "").replace(/[·•|]/g, " ").replace(/\s+/g, " ").trim();
    if (!fullName) return null;
    const headline = grab([".entity-result__primary-subtitle", ".artdeco-entity-lockup__subtitle"]);
    const parts = fullName.split(/\s+/);
    return {
      profileUrl,
      fullName,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      headline,
      location: grab([".entity-result__secondary-subtitle", ".artdeco-entity-lockup__caption"]),
      company: (headline.split(/\s+at\s+/i)[1] || "").trim(),
      title: (headline.split(/\s+at\s+/i)[0] || headline).trim(),
      degree,
    };
  }

  /* ---------------------------------------------------------------- */

  function bar() {
    let el = document.getElementById(BAR_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = BAR_ID;
    el.innerHTML = `
      <span class="ft-brand"><span class="ft-mark">F</span> Followthroo</span>
      <span class="ft-sep"></span>
      <button class="ft-link" data-ft="all">Select all</button>
      <span class="ft-count" data-ft="count">No one selected</span>
      <span class="ft-msg" data-ft="msg"></span>
      <button class="ft-link" data-ft="every" hidden></button>
      <button class="ft-primary" data-ft="add" disabled>Add to Followthroo</button>
    `;
    el.querySelector('[data-ft="all"]').addEventListener("click", toggleAll);
    el.querySelector('[data-ft="add"]').addEventListener("click", add);
    el.querySelector('[data-ft="every"]').addEventListener("click", addEveryPage);
    return el;
  }

  function mountBar() {
    const cards = rowCards();
    if (!cards.length) return false;
    const list = cards[0].closest("ul") || cards[0].parentElement;
    if (!list || !list.parentElement) return false;
    const el = bar();
    if (el.parentElement !== list.parentElement) list.parentElement.insertBefore(el, list);
    return true;
  }

  function paint() {
    const el = document.getElementById(BAR_ID);
    if (!el) return;
    const n = state.selected.size;
    const total = rowCards().length;
    el.querySelector('[data-ft="count"]').textContent =
      n === 0 ? `No one selected · ${total} on this page` : `${n} selected`;
    el.querySelector('[data-ft="all"]').textContent = n >= total && total > 0 ? "Clear selection" : "Select all";
    const btn = el.querySelector('[data-ft="add"]');
    btn.disabled = n === 0 || state.busy;
    btn.textContent = state.busy ? "Adding…" : n === 0 ? "Add to Followthroo" : `Add ${n} to Followthroo`;

    // Offered only when there is genuinely more than this page to get.
    const every = el.querySelector('[data-ft="every"]');
    const all = totalResults();
    if (all && all > total) {
      every.hidden = false;
      every.disabled = state.busy;
      every.textContent = `Add all ${all.toLocaleString()} results`;
    } else {
      every.hidden = true;
    }
  }

  function message(text, kind) {
    const el = document.getElementById(BAR_ID);
    if (!el) return;
    const m = el.querySelector('[data-ft="msg"]');
    m.textContent = text || "";
    m.className = `ft-msg ${kind === "err" ? "ft-err" : kind === "ok" ? "ft-ok" : ""}`;
    if (text) setTimeout(() => { if (m.textContent === text) m.textContent = ""; }, 6000);
  }

  /** A checkbox per row, positioned in the gutter so it never covers content. */
  function decorate() {
    for (const card of rowCards()) {
      if (card.querySelector(`.${CHECK_CLASS}`)) continue;
      const data = rowData(card);
      if (!data) continue;
      card.classList.add("ft-anchor");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = CHECK_CLASS;
      box.title = `Add ${data.fullName} to Followthroo`;
      box.checked = state.selected.has(data.profileUrl);
      box.addEventListener("click", (e) => e.stopPropagation());
      box.addEventListener("change", () => {
        if (box.checked) state.selected.set(data.profileUrl, data);
        else state.selected.delete(data.profileUrl);
        paint();
      });
      card.appendChild(box);
    }
  }

  function toggleAll() {
    const cards = rowCards();
    const all = state.selected.size >= cards.length && cards.length > 0;
    state.selected.clear();
    if (!all) {
      for (const card of cards) {
        const d = rowData(card);
        if (d) state.selected.set(d.profileUrl, d);
      }
    }
    document.querySelectorAll(`.${CHECK_CLASS}`).forEach((b) => { b.checked = !all; });
    paint();
  }

  /**
   * The whole result set, not just this page.
   *
   * Hands off to the background job rather than trying to paginate from here: a
   * content script dies the moment the person navigates, and losing 2,000 rows
   * at page 40 would be a miserable way to find that out.
   */
  async function addEveryPage() {
    if (state.busy) return;
    const cfg = await chrome.storage.local.get(["apiBase", "token"]);
    if (!cfg.apiBase || !cfg.token) {
      message("Connect the extension first — click its icon.", "err");
      return;
    }
    state.busy = true;
    paint();
    try {
      const res = await fetch(`${cfg.apiBase}/api/linkedin/scrape/collect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: location.href, allPages: true, estimated: totalResults() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `server said ${res.status}`);
      message(`Reading all ${json.data.maxResults} in the background — watch it in Followthroo`, "ok");
    } catch (e) {
      message(String((e && e.message) || e), "err");
    } finally {
      state.busy = false;
      paint();
    }
  }

  async function add() {
    if (state.busy || state.selected.size === 0) return;
    const cfg = await chrome.storage.local.get(["apiBase", "token"]);
    if (!cfg.apiBase || !cfg.token) {
      message("Connect the extension first — click its icon.", "err");
      return;
    }
    state.busy = true;
    paint();

    const rows = Array.from(state.selected.values());
    try {
      const res = await fetch(`${cfg.apiBase}/api/linkedin/scrape/collect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: location.href, rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `server said ${res.status}`);

      const { created = 0, duplicates = 0 } = json.data || {};
      message(
        duplicates ? `Added ${created}, ${duplicates} already yours` : `Added ${created}`,
        "ok",
      );
      state.selected.clear();
      document.querySelectorAll(`.${CHECK_CLASS}`).forEach((b) => { b.checked = false; });
    } catch (e) {
      message(String((e && e.message) || e), "err");
    } finally {
      state.busy = false;
      paint();
    }
  }

  /* ---------------------------------------------------------------- */

  /**
   * LinkedIn is a single-page app: navigating between searches replaces the
   * list without a page load, and results stream in as you scroll. So rather
   * than running once, watch and re-apply — debounced, because the feed mutates
   * constantly and re-scanning on every mutation would be its own performance bug.
   */
  let timer = null;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      styles();
      if (mountBar()) {
        decorate();
        paint();
      }
    }, 400);
  }

  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  refresh();
})();
