/**
 * Every job Followthroo can do on LinkedIn — the full catalogue from
 * docs/phantombuster.md, as data.
 *
 * Dependency-free on purpose: the LinkedIn screen is a client component, so this
 * must not reach for prisma (see lib/assignment-rules.ts for the same split).
 *
 * ---- How the three mechanisms differ, and why ----
 *
 * `read`    — the extension opens a page in the rep's own logged-in tab and
 *             reads what is already rendered. Nothing is clicked. This is most
 *             of the catalogue.
 *
 * `confirm` — the extension opens the page and fills the box (invite note,
 *             message, comment), then STOPS. A real person reads it and clicks
 *             Send themselves. This is every outbound action, and it is the
 *             line drawn in extension/README.md: automate everything up to the
 *             click, never the click.
 *
 * `api`     — LinkedIn's official API, via OAuth. Exactly one job qualifies
 *             (posting, `w_member_social`); everything else people want lives in
 *             Sales Navigator and Marketing APIs, which are partner-gated and
 *             closed to new applicants.
 *
 * `vendor`  — needs a third-party email-discovery service. LinkedIn never
 *             exposes email addresses; PhantomBuster's "to Emails" flows are it
 *             reselling Dropcontact or Hunter on credits. Not buildable until
 *             that vendor is chosen.
 */

export type Mechanism = "read" | "confirm" | "api" | "vendor";

export type JobCategory =
  | "Find people"
  | "Research"
  | "Reach out"
  | "Engage"
  | "Maintain your network";

export interface CatalogueJob {
  /** Stable key. `read` jobs match ScrapeKind in detect.ts. */
  key: string;
  name: string;
  /** What it does, in the person's words — not the phantom's name. */
  summary: string;
  category: JobCategory;
  mechanism: Mechanism;
  /** What the person supplies. */
  input: string;
  /** Ceiling per day or per run, from docs/phantombuster.md. */
  limit?: string;
  /** Live now, or waiting on something. */
  status: "live" | "planned" | "blocked";
  /** Said plainly when it is not live, so nobody waits on a mystery. */
  blockedReason?: string;
  /** Needs admin rights on the page in question. */
  requiresAdmin?: boolean;
}

export const CATALOGUE: CatalogueJob[] = [
  // ---- Find people -------------------------------------------------------
  {
    key: "search_export",
    name: "People from a search",
    summary: "Every person in a LinkedIn or Sales Navigator people search.",
    category: "Find people",
    mechanism: "read",
    input: "A people-search URL",
    limit: "1,000 per search — LinkedIn's own cap",
    status: "live",
  },
  {
    key: "company_employees",
    name: "People at a company",
    summary: "Everyone listed as working at a company.",
    category: "Find people",
    mechanism: "read",
    input: "A company page URL",
    limit: "500 per run",
    status: "live",
  },
  {
    key: "post_engagers",
    name: "People who engaged with a post",
    summary: "Everyone who liked or commented — usually the warmest list on LinkedIn, because they raised their hand in public.",
    category: "Find people",
    mechanism: "read",
    input: "A post URL",
    limit: "200 per run",
    status: "live",
  },
  {
    key: "group_members",
    name: "Members of a group",
    summary: "The member list of a group you have joined.",
    category: "Find people",
    mechanism: "read",
    input: "A group URL",
    limit: "500 per run",
    status: "live",
  },
  {
    key: "event_guests",
    name: "People at an event",
    summary: "Everyone registered for an event.",
    category: "Find people",
    mechanism: "read",
    input: "An event URL",
    limit: "500 per run",
    status: "live",
  },
  {
    key: "connections_export",
    name: "Your own connections",
    summary: "Your whole 1st-degree network, with current roles.",
    category: "Find people",
    mechanism: "read",
    input: "Nothing — reads your connections page",
    limit: "5,000",
    status: "live",
  },
  {
    key: "company_followers",
    name: "Followers of your company page",
    summary: "People already following you — warm by definition.",
    category: "Find people",
    mechanism: "read",
    input: "Your company page URL",
    status: "live",
    requiresAdmin: true,
  },

  // ---- Research ----------------------------------------------------------
  {
    key: "profile_scrape",
    name: "A full profile",
    summary: "Headline, role, company, location, summary and work history.",
    category: "Research",
    mechanism: "read",
    input: "A profile URL",
    limit: "80 a day — the safe rate for profile loads",
    status: "live",
  },
  {
    key: "company_scrape",
    name: "Company details",
    summary: "Website, industry, size, headquarters, description, founding year.",
    category: "Research",
    mechanism: "read",
    input: "A company page URL",
    status: "live",
  },
  {
    key: "activity_extract",
    name: "Someone's recent posts",
    summary: "What they have been posting about — worth reading before you write to them.",
    category: "Research",
    mechanism: "read",
    input: "A profile URL",
    limit: "50 posts per profile",
    status: "live",
  },
  {
    key: "profile_url_finder",
    name: "Find profile URLs",
    summary: "Turn a list of names and companies into LinkedIn profile links.",
    category: "Research",
    mechanism: "api",
    input: "Names + company names",
    limit: "No LinkedIn quota — searches the open web",
    status: "planned",
    blockedReason: "Searches the open web rather than LinkedIn, so it needs no extension. Not built yet.",
  },
  {
    key: "company_url_finder",
    name: "Find company URLs",
    summary: "Turn a list of company names into LinkedIn company page links.",
    category: "Research",
    mechanism: "api",
    input: "Company names",
    limit: "No LinkedIn quota — searches the open web",
    status: "planned",
    blockedReason: "Searches the open web rather than LinkedIn, so it needs no extension. Not built yet.",
  },
  {
    key: "inbox_scrape",
    name: "Sync your LinkedIn inbox",
    summary: "Brings LinkedIn replies into Followthroo, so a lead who answers there stops being sequenced.",
    category: "Research",
    mechanism: "read",
    input: "Nothing — reads your messaging page",
    status: "planned",
    blockedReason: "Next up. Until this exists, a reply on LinkedIn does not stop a sequence the way an email reply does.",
  },

  // ---- Reach out ---------------------------------------------------------
  {
    key: "invite",
    name: "Connection requests",
    summary: "Queues a personalised invite. Your browser opens the profile and fills the note; you click Send.",
    category: "Reach out",
    mechanism: "confirm",
    input: "Contacts with a LinkedIn URL",
    limit: "20 a day, note max 300 characters",
    status: "live",
  },
  {
    key: "message",
    name: "Direct messages",
    summary: "Queues a message to a 1st-degree connection. Fills the box; you click Send.",
    category: "Reach out",
    mechanism: "confirm",
    input: "1st-degree connections",
    limit: "80 a day",
    status: "live",
  },
  {
    key: "group_message",
    name: "Message group members",
    summary: "Reaches 2nd and 3rd degree members of a group you share, without connecting first.",
    category: "Reach out",
    mechanism: "confirm",
    input: "A group + member profiles",
    status: "planned",
    blockedReason: "Not built yet. The one path to 2nd/3rd degree without an invite.",
  },
  {
    key: "outreach_sequence",
    name: "Invite, then follow up",
    summary: "A sequence: connection request, wait for acceptance, then messages — stopping the moment they reply.",
    category: "Reach out",
    mechanism: "confirm",
    input: "A contact list and templates",
    status: "blocked",
    blockedReason:
      "Needs acceptance tracking first. LinkedIn only allows messages to 1st-degree, so a follow-up sent before they accept simply fails.",
  },
  {
    key: "connections_to_emails",
    name: "Find emails for your connections",
    summary: "Work email addresses for people you are connected to.",
    category: "Reach out",
    mechanism: "vendor",
    input: "Your connections",
    status: "blocked",
    blockedReason: "LinkedIn never exposes email addresses. Needs an enrichment provider (Dropcontact, Hunter or similar) — a decision, then a day's work.",
  },
  {
    key: "search_to_emails",
    name: "Find emails from a search",
    summary: "Search results enriched with work email addresses.",
    category: "Reach out",
    mechanism: "vendor",
    input: "A people-search URL",
    status: "blocked",
    blockedReason: "Same enrichment provider as above.",
  },
  {
    key: "group_members_to_emails",
    name: "Find emails for group members",
    summary: "Group members enriched with work email addresses.",
    category: "Reach out",
    mechanism: "vendor",
    input: "A group URL",
    status: "blocked",
    blockedReason: "Same enrichment provider as above.",
  },

  // ---- Engage ------------------------------------------------------------
  {
    key: "post",
    name: "Publish a post",
    summary: "Post to your own feed or company page, on a schedule.",
    category: "Engage",
    mechanism: "api",
    input: "Post text and timing",
    limit: "No scraping quota — LinkedIn's official API",
    status: "planned",
    blockedReason:
      "The only job here with a fully official API path (w_member_social). Your LinkedIn app credentials already cover it — worth building for exactly that reason.",
  },
  {
    key: "like",
    name: "React to posts",
    summary: "Opens a prospect's post so you can react to it.",
    category: "Engage",
    mechanism: "confirm",
    input: "Post or profile URLs",
    limit: "Keep it low — this is engagement, not outreach",
    status: "planned",
  },
  {
    key: "comment",
    name: "Comment on posts",
    summary: "Opens the post with your comment drafted; you post it.",
    category: "Engage",
    mechanism: "confirm",
    input: "Post URLs and comment text",
    limit: "10–20 a day",
    status: "planned",
  },
  {
    key: "endorse",
    name: "Endorse skills",
    summary: "Endorses a connection's top skills, which notifies them.",
    category: "Engage",
    mechanism: "confirm",
    input: "1st-degree profiles",
    status: "planned",
  },
  {
    key: "profile_visit",
    name: "View profiles",
    summary: "Opens profiles so you appear in their “who viewed you”.",
    category: "Engage",
    mechanism: "confirm",
    input: "Profile URLs",
    limit: "80 a day",
    status: "planned",
  },
  {
    key: "follow",
    name: "Follow people or pages",
    summary: "Follow without sending a connection request.",
    category: "Engage",
    mechanism: "confirm",
    input: "Profile or company URLs",
    status: "planned",
  },
  {
    key: "event_invite",
    name: "Invite people to an event",
    summary: "Invites your connections to a LinkedIn event.",
    category: "Engage",
    mechanism: "confirm",
    input: "An event URL",
    limit: "100–200 a day",
    status: "planned",
  },
  {
    key: "page_invite",
    name: "Invite people to follow your page",
    summary: "Uses your company page's monthly invitation credits.",
    category: "Engage",
    mechanism: "confirm",
    input: "Your company page URL",
    limit: "50 per run, 250 a month — LinkedIn's own credit",
    status: "planned",
    requiresAdmin: true,
  },

  // ---- Maintain your network ---------------------------------------------
  {
    key: "accept_invites",
    name: "Accept incoming invitations",
    summary: "Clears your pending invitations, optionally with a welcome message.",
    category: "Maintain your network",
    mechanism: "confirm",
    input: "Nothing — reads your invitation manager",
    status: "planned",
  },
  {
    key: "withdraw_invites",
    name: "Withdraw old invitations",
    summary: "Pulls back requests nobody accepted. A large pending queue hurts your account standing.",
    category: "Maintain your network",
    mechanism: "confirm",
    input: "An age threshold, e.g. 30 days",
    status: "planned",
  },
  {
    key: "remove_connections",
    name: "Remove connections",
    summary: "Disconnects from people on a list.",
    category: "Maintain your network",
    mechanism: "confirm",
    input: "Profile URLs",
    status: "planned",
  },
  {
    key: "unfollow",
    name: "Unfollow without disconnecting",
    summary: "Quietens your feed while staying connected.",
    category: "Maintain your network",
    mechanism: "confirm",
    input: "Profile URLs",
    status: "planned",
  },
];

export const CATEGORIES: JobCategory[] = [
  "Find people",
  "Research",
  "Reach out",
  "Engage",
  "Maintain your network",
];

export const MECHANISM_LABEL: Record<Mechanism, { label: string; detail: string }> = {
  read: {
    label: "Reads only",
    detail: "Your browser opens the page and reads what is already on it. Nothing is clicked or sent.",
  },
  confirm: {
    label: "You click send",
    detail: "Your browser opens the page and fills the box. A real person reads it and sends it — we never click for you.",
  },
  api: {
    label: "Official API",
    detail: "Goes through LinkedIn's own API. No browser, no extension, no risk to your account.",
  },
  vendor: {
    label: "Needs a provider",
    detail: "LinkedIn does not expose email addresses. This needs a third-party enrichment service.",
  },
};

export const byCategory = (c: JobCategory) => CATALOGUE.filter((j) => j.category === c);
export const liveCount = () => CATALOGUE.filter((j) => j.status === "live").length;
