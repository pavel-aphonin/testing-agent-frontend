import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUser } from "@/types";

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
  setSession: (token: string, user: CurrentUser) => void;
  setUser: (user: CurrentUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "ta-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
