/**
 * Tour targets are plain `data-tour` attributes rather than a ref registry.
 *
 * Three reasons this has to be an attribute:
 *  - Several targets live in server components, which cannot hold a `useRef`.
 *  - The tour spans routes. Refs registered by a route that has since unmounted
 *    are gone by definition, which defeats the entire point.
 *  - Most targets sit inside a `.map()`, where spreading one prop is trivial and
 *    threading a ref through `<Link>`/`<Panel>` is not.
 *
 * Playwright uses the same selector, so the tests and the tour agree on names.
 */
export const TOUR_TARGETS = [
  // Kept as `sidebar-contacts` though the row now reads "Leads" — renaming the id
  // would churn every step and spec for nothing. The id names the destination.
  "sidebar-contacts",
  "sidebar-campaigns",
  "sidebar-inbox",
  "sidebar-tasks",
  "overview-stats",
  "overview-checklist",
  "leads-import",
  "campaigns-new",
  "profile-menu",
] as const;

export type TourTargetId = (typeof TOUR_TARGETS)[number];

/** Spread onto the element a tour step points at: `{...tourTarget("sidebar-contacts")}` */
export const tourTarget = (id: TourTargetId) => ({ "data-tour": id });

export const tourSelector = (id: TourTargetId) => `[data-tour="${id}"]`;
