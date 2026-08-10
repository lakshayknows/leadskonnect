import type { Placement } from "@floating-ui/react";
import type { TourTargetId } from "./target";

export type TourStep = {
  target: TourTargetId;
  /** Route this step lives on. The tour navigates there before measuring. */
  path: string;
  title: string;
  body: string;
  placement?: Placement;
  /**
   * What to do if the target never appears (slow route, feature not enabled).
   * "center" keeps the copy and drops the spotlight — the tour must never
   * dead-end on a missing element.
   */
  onMissing?: "center" | "skip";
};

/**
 * Seven steps, ordered as the work actually happens: get contacts in, write
 * what you'll say, sequence it, watch replies land, connect the mailbox that
 * sends it. Each names a task, not a UI control — "Start with your contacts",
 * not "This is the Contacts button".
 */
export const PRODUCT_TOUR: TourStep[] = [
  {
    target: "overview-stats",
    path: "/dashboard",
    title: "Your outreach at a glance",
    body: "Sent, replies and active campaigns update as your sequences run. It's quiet right now because nothing has gone out yet.",
    placement: "bottom",
  },
  {
    target: "sidebar-contacts",
    path: "/dashboard",
    title: "Start with your contacts",
    body: "Import a CSV or add people one at a time. Everything else in Followthroo points at this list.",
    placement: "right",
  },
  {
    target: "leads-import",
    path: "/dashboard/leads",
    title: "Bring your list in",
    body: "Upload a CSV and we'll match the columns for you. Duplicates resolve to one contact rather than getting messaged twice.",
    placement: "bottom",
  },
  {
    target: "sidebar-campaigns",
    path: "/dashboard/leads",
    title: "Sequence the follow-up",
    body: "A campaign is the order your messages go out in — email now, a nudge in three days, stop the moment someone replies.",
    placement: "right",
  },
  {
    target: "campaigns-new",
    path: "/dashboard/campaigns",
    title: "Build it from a preset",
    body: "Start with a three-step drip or a stop-on-reply sequence, then change any step. You choose who to enroll when you launch.",
    placement: "bottom",
  },
  {
    target: "sidebar-inbox",
    path: "/dashboard/campaigns",
    title: "Replies land here",
    body: "Every channel writes to one thread per contact, so a WhatsApp reply and an email reply sit in the same conversation.",
    placement: "right",
  },
  {
    target: "sidebar-accounts",
    path: "/dashboard/campaigns",
    title: "Connect a mailbox to send",
    body: "Campaigns stay in draft until a sending account is connected. Connect Gmail in one click, or add SMTP details.",
    placement: "right",
  },
];
