import { apiClient } from "@/api/client";
import type { TestDataCreate, TestDataRead, TestDataUpdate } from "@/types";

export async function listTestData(workspaceId?: string | null): Promise<TestDataRead[]> {
  const params = workspaceId ? { workspace_id: workspaceId } : {};
  const response = await apiClient.get<TestDataRead[]>("/api/test-data", { params });
  return response.data;
}

export async function createTestData(
  payload: TestDataCreate,
): Promise<TestDataRead> {
  const response = await apiClient.post<TestDataRead>(
    "/api/test-data",
    payload,
  );
  return response.data;
}

export async function updateTestData(
  id: string,
  payload: TestDataUpdate,
): Promise<TestDataRead> {
  const response = await apiClient.patch<TestDataRead>(
    `/api/test-data/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteTestData(id: string): Promise<void> {
  await apiClient.delete(`/api/test-data/${id}`);
}
