import { apiClient } from "@/api/client";
import type { Run, RunCreate } from "@/types";

export async function listRuns(): Promise<Run[]> {
  const response = await apiClient.get<Run[]>("/api/runs");
  return response.data;
}

export async function createRun(payload: RunCreate): Promise<Run> {
  const response = await apiClient.post<Run>("/api/runs", payload);
  return response.data;
}

export async function getRun(id: string): Promise<Run> {
  const response = await apiClient.get<Run>(`/api/runs/${id}`);
  return response.data;
}

export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/api/runs/${id}`);
}
