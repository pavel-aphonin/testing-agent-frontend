import { apiClient } from "@/api/client";

export interface DefectRead {
  id: string;
  run_id: string;
  step_idx: number | null;
  screen_id_hash: string | null;
  screen_name: string | null;
  priority: "P0" | "P1" | "P2" | "P3";
  kind: string;
  title: string;
  description: string;
  screenshot_path: string | null;
  external_ticket_id: string | null;
  /** Raw LLM rationale from the worker's defect detector. Null when
   *  the heuristic fallback fired or the detector was disabled. */
  llm_analysis_json: Record<string, unknown> | null;
  created_at: string;
}

export async function listRunDefects(
  runId: string,
  filters?: { priority?: string; kind?: string },
): Promise<DefectRead[]> {
  const params = new URLSearchParams();
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.kind) params.set("kind", filters.kind);
  const qs = params.toString();
  const { data } = await apiClient.get<DefectRead[]>(
    `/api/runs/${runId}/defects${qs ? `?${qs}` : ""}`,
  );
  return data;
}
