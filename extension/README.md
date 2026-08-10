# Followthroo — LinkedIn Assistant (Chrome extension)

LinkedIn does not grant invite/DM access through its developer program, and its User
Agreement (Section 8.2) prohibits bots or automated methods for adding connections or
sending messages. So this extension is **human-assisted, not autonomous**: it drafts your
queued invites/messages **from your own logged-in LinkedIn session**, in your browser —
but a real person reviews and clicks Send. Nothing is sent from Followthroo's servers, and
nothing is sent by a script.

## How it works

1. A campaign step with the **LinkedIn** channel enqueues a `LinkedInAction` in Followthroo.
2. This extension polls `GET /api/linkedin/queue` (authenticated by your personal token),
   claims **one** action at a time, opens the lead's profile in a **foregrounded** tab, and
   fills the invite note or message box via the page DOM — then stops. It never clicks Send.
3. You review what's filled in the open tab and send it yourself. Then, in the extension
   popup, click **"I sent it"** (or **Skip** if you didn't) — that confirmation is what
   `POST /api/linkedin/queue`s the outcome, records it in your CRM timeline + reports, and
   resumes polling for the next one after a randomized delay.

Only one action is drafted at a time — the extension won't open a second tab while one is
still awaiting your review. If an action sits drafted for 40+ minutes with no response
(browser closed, tab lost), the server releases it back to the queue rather than blocking
it forever.

Server enforces the daily invite cap; the extension paces one action per tick (default
45–120s apart). Both are configurable in **Settings → LinkedIn**.

## Install (load unpacked)

1. In Followthroo, open **Settings → LinkedIn** and copy your **connection token**.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   this `extension/` folder.
3. Click the extension icon → paste your **App URL** (`https://app.followthroo.com`) and
   **token** → **Save** → **Start**.
4. Stay logged into LinkedIn in the same browser. When an action is ready, its tab opens
   in the foreground — review it there and confirm in the popup.

## Notes & limits

- **Terms of Service:** this drafts from a personal LinkedIn session, which LinkedIn's ToS
  still treats as automation-adjacent even with a human sending — keep caps conservative
  (≤ ~20 invites/day), warm up new accounts, and don't leave large batches queued
  unattended for long stretches.
- LinkedIn changes its markup frequently — if drafts stop filling, the selectors in
  `background.js` (`fillLinkedInAction`) may need a refresh.
- The extension only ever touches `linkedin.com` (to draft) and your Followthroo app
  domain (to sync the queue) — see `host_permissions` in `manifest.json`.
