# Followthroo — LinkedIn Assistant (Chrome extension)

LinkedIn does not grant invite/DM access through its developer program, so Followthroo
automates LinkedIn the way lemlist/Expandi do: a companion extension performs your queued
actions **from your own logged-in LinkedIn session**, in your browser, with humanized
pacing and daily caps. Nothing is sent from Followthroo's servers.

## How it works

1. A campaign step with the **LinkedIn** channel enqueues a `LinkedInAction` in Followthroo.
2. This extension polls `GET /api/linkedin/queue` (authenticated by your personal token),
   claims **one** action at a time, opens the lead's profile in a background tab, and
   performs the invite (or message) via the page DOM.
3. It reports the result to `POST /api/linkedin/queue`, which records it in your CRM
   timeline + reports, then waits a randomized delay before the next one.

Server enforces the daily invite cap; the extension paces one action per tick (default
45–120s apart). Both are configurable in **Settings → LinkedIn**.

## Install (load unpacked)

1. In Followthroo, open **Settings → LinkedIn** and copy your **connection token**.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   this `extension/` folder.
3. Click the extension icon → paste your **App URL** (`https://www.followthroo.com`) and
   **token** → **Save** → **Start**.
4. Stay logged into LinkedIn in the same browser. The extension does the rest.

## Notes & limits

- **Terms of Service:** automating LinkedIn from a personal account is against LinkedIn's
  ToS and carries account-risk. Keep caps conservative (≤ ~20 invites/day), warm up new
  accounts, and don't run it unattended for long stretches. Use at your own risk.
- LinkedIn changes its markup frequently — if invites stop going out, the selectors in
  `background.js` (`performLinkedInAction`) may need a refresh.
- The extension only ever touches `linkedin.com` (to act) and your Followthroo domain
  (to sync the queue) — see `host_permissions` in `manifest.json`.
