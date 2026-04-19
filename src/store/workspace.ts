import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorkspaceBrief } from "@/types";

interface WorkspaceState {
  /** Currently selected workspace (null = none selected). */
  current: WorkspaceBrief | null;
  setCurrent: (ws: WorkspaceBrief | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      current: null,
      setCurrent: (ws) => set({ current: ws }),
    }),
    {
      name: "ta-workspace",
      partialize: (state) => ({ current: state.current }),
    },
  ),
);
