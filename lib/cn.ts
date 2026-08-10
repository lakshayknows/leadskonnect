import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes so a caller's `className` wins over a component's base
 * classes instead of racing them in the stylesheet. Before this existed the
 * primitives concatenated `props.className` after their own, which is why call
 * sites reach for `!important` modifiers (`!bg-tint`, `!pl-9`). Those keep
 * working — tailwind-merge understands the `!` prefix — but new code shouldn't
 * need them.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
