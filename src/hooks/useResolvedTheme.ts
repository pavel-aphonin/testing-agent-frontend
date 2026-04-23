import { useEffect } from "react";

import { useThemeStore } from "@/store/theme";

/**
 * Keep ``resolved`` in the theme store in sync with the user's mode
 * choice + OS preference. Call this exactly once near the app root
 * (App.tsx does). Listens for prefers-color-scheme changes so the app
 * follows the OS live when the user sets mode="system".
 */
export function useResolvedTheme(): "light" | "dark" {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const setResolved = useThemeStore((s) => s.setResolved);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const next: "light" | "dark" =
        mode === "system"
          ? mq.matches ? "dark" : "light"
          : mode;
      setResolved(next);
    };
    apply();

    // Only listen to OS changes when the user picked "system" — no
    // reason to churn store state otherwise.
    if (mode !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode, setResolved]);

  return resolved;
}
