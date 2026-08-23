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
 * Seven steps, ordered as the work actually happens: see what needs you, get
 * leads in, write what you'll say, sequence it, watch replies land, and never
 * lose the follow-up. Each names a task, not a UI control — "Start with your
 * leads", not "This is the Leads button".
 */
export const PRODUCT_TOUR: TourStep[] = [
  {
    target: "overview-stats",
    path: "/dashboard",
    title: "What needs you today",
    body: "Home is a work queue, not a report. New leads, follow-ups due, replies waiting — each one clicks straight through to the work.",
    placement: "bottom",
  },
  {
    target: "sidebar-contacts",
    path: "/dashboard",
    title: "Start with your leads",
    body: "Everyone you're trying to reach lives here, whichever channel or source they came from. Everything else in Followthroo points at this list.",
    placement: "right",
  },
  {
    target: "leads-import",
    path: "/dashboard/leads",
    title: "Bring your list in",
    body: "Add someone by hand or upload a CSV and we'll match the columns for you. Duplicates resolve to one lead rather than getting messaged twice.",
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
    target: "sidebar-tasks",
    path: "/dashboard/campaigns",
    title: "Nothing falls through",
    body: "When someone replies and nobody has answered, a follow-up appears here on its own. Every lead always has a next action — that's the whole idea.",
    placement: "right",
  },
];
