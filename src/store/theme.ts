import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-user UI theme preference. Each browser picks its own mode — no
 * server-side storage. Admins can tune theme *colors* via system
 * branding; the light/dark *mode* stays a personal setting.
 *
 * "system" means follow the OS preference via prefers-color-scheme.
 */
export type ThemeMode = "light" | "dark" | "system";

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Resolved mode (light|dark) — "system" is collapsed to whichever
   * the user's OS currently reports. Updated reactively; see
   * useResolvedTheme in hooks/. */
  resolved: "light" | "dark";
  setResolved: (m: "light" | "dark") => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: "system",
      resolved: typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
      setMode: (mode) => set({ mode }),
      setResolved: (resolved) => set({ resolved }),
    }),
    {
      name: "ta-theme",
      // Only the user's *chosen* mode is persisted — the resolved
      // value is recomputed each startup from that + current OS.
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
);
