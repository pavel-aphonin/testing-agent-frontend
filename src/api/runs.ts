import { apiClient } from "@/api/client";
import type { AppUploadResponse, Run, RunCreate, RunCreateV2, RunResults } from "@/types";

export async function listRuns(): Promise<Run[]> {
  const response = await apiClient.get<Run[]>("/api/runs");
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

export async function uploadApp(file: File): Promise<AppUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<AppUploadResponse>(
    "/api/uploads/app",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
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

export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/api/runs/${id}`);
}
