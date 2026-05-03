import { apiClient } from "@/api/client";
import type { AppUploadResponse, Run, RunCreate, RunCreateV2, RunResults } from "@/types";

export async function listRuns(workspaceId?: string | null): Promise<Run[]> {
  const params = workspaceId ? { workspace_id: workspaceId } : {};
  const response = await apiClient.get<Run[]>("/api/runs", { params });
  return response.data;
}

export async function createRun(payload: RunCreate): Promise<Run> {
  const response = await apiClient.post<Run>("/api/runs", payload);
  return response.data;
}

export async function createRunV2(payload: RunCreateV2): Promise<Run> {
  const response = await apiClient.post<Run>("/api/runs/v2", payload);
  return response.data;
}

export async function uploadApp(
  file: File,
  // PER-47: optional progress callback so the UI can render a percentage
  // instead of a static "loading" placeholder. Receives 0..100.
  onProgress?: (percent: number) => void,
): Promise<AppUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<AppUploadResponse>(
    "/api/uploads/app",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress
        ? (e) => {
            // ``total`` is undefined when the server uses chunked transfer
            // encoding — fall back to "indeterminate" by passing 100 only
            // once the upload finishes (loaded === total === undefined).
            if (e.total) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          }
        : undefined,
    },
  );
  return response.data;
}

export async function getRun(id: string): Promise<Run> {
  const response = await apiClient.get<Run>(`/api/runs/${id}`);
  return response.data;
}

export async function getRunResults(id: string): Promise<RunResults> {
  const response = await apiClient.get<RunResults>(`/api/runs/${id}/results`);
  return response.data;
}

/* ── Screen elements (PER-38) ───────────────────────────────────── */

export interface ScreenElement {
  type?: string;
  label?: string;
  value?: string;
  test_id?: string;
  identifier?: string;
  frame?: { x?: number; y?: number; width?: number; height?: number } | number[];
  enabled?: boolean;
  // Worker may add more fields per-platform; keep open-ended.
  [key: string]: unknown;
}

export interface ScreenElementsResponse {
  screen_hash: string;
  name: string;
  screenshot_path: string | null;
  elements: ScreenElement[];
}

export async function getScreenElements(
  runId: string,
  screenHash: string,
): Promise<ScreenElementsResponse> {
  const r = await apiClient.get<ScreenElementsResponse>(
    `/api/runs/${runId}/screens/${screenHash}/elements`,
  );
  return r.data;
}

export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/api/runs/${id}`);
}

export async function cancelRun(id: string): Promise<void> {
  await apiClient.post(`/api/runs/${id}/cancel`);
}

/* ── Run diff (PER-27) ──────────────────────────────────────────── */

export interface RunDiffPayload {
  current_run_id: string;
  baseline_run_id: string;
  screens_added: { hash: string; name: string }[];
  screens_removed: { hash: string; name: string }[];
  edges_added: { source_hash: string; target_hash: string; action_type: string; success: boolean }[];
  edges_removed: { source_hash: string; target_hash: string; action_type: string; success: boolean }[];
  edges_changed: {
    source_hash: string; target_hash: string; action_type: string;
    old_success: boolean; new_success: boolean;
  }[];
  defects_new: { id: string; screen_name: string | null; priority: string; kind: string; title: string }[];
  defects_resolved: { id: string; priority: string; kind: string; title: string }[];
  defects_persisted: { id: string; priority: string; kind: string; title: string }[];
  summary: Record<string, number>;
  error?: string;
}

export async function getRunDiff(
  currentId: string,
  againstId: string,
): Promise<RunDiffPayload> {
  const r = await apiClient.get<RunDiffPayload>(
    `/api/runs/${currentId}/diff`,
    { params: { against: againstId } },
  );
  return r.data;
}

/* ── Replay / start-from-screen (PER-40 / PER-41) ─────────────── */

export interface ReplayPathRequest {
  edge_ids: number[];
  app_file_id?: string | null;
  device_config_id?: string | null;
  mode?: string | null;
  continue_after_replay?: boolean;
}

export async function replayPath(
  sourceRunId: string,
  payload: ReplayPathRequest,
): Promise<Run> {
  const r = await apiClient.post<Run>(
    `/api/runs/${sourceRunId}/replay-path`,
    payload,
  );
  return r.data;
}

export interface StartFromScreenRequest {
  target_screen_hash: string;
  max_steps?: number;
  mode?: string | null;
  app_file_id?: string | null;
  device_config_id?: string | null;
}

export async function startFromScreen(
  sourceRunId: string,
  payload: StartFromScreenRequest,
): Promise<Run> {
  const r = await apiClient.post<Run>(
    `/api/runs/${sourceRunId}/start-from-screen`,
    payload,
  );
  return r.data;
}
