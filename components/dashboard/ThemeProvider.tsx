"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const Ctx = createContext<{
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
} | null>(null);

const COOKIE = "ft-theme";

function systemIsDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  const el = document.documentElement;
  el.dataset.themePref = pref;
  el.dataset.theme = dark ? "dark" : "light";
  el.style.colorScheme = dark ? "dark" : "light";
  return dark ? ("dark" as const) : ("light" as const);
}

/**
 * Theme state. The inline script in `app/layout.tsx` has already stamped
 * `data-theme` before first paint, so this reads what the DOM already says
 * rather than deciding it again — otherwise the first client render would
 * disagree with the server HTML.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const el = document.documentElement;
    const current = (el.dataset.themePref as ThemePref) || "system";
    setPrefState(current);
    setResolved(el.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    setResolved(apply(p));
    document.cookie = `${COOKIE}=${p}; path=/; max-age=31536000; SameSite=Lax`;
    // Mirror to the account so the choice follows the user to another device.
    // Fire-and-forget: the cookie is already authoritative for this browser.
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "theme", theme: p }),
    }).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ pref, resolved, setPref }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
