import { apiClient } from "@/api/client";
import type { ScenarioCreate, ScenarioRead, ScenarioUpdate } from "@/types";

export async function listScenarios(
  workspaceId?: string | null,
  options?: { onlyActive?: boolean },
): Promise<ScenarioRead[]> {
  const params: Record<string, string | boolean> = {};
  if (workspaceId) params.workspace_id = workspaceId;
  if (options?.onlyActive) params.only_active = true;
  const response = await apiClient.get<ScenarioRead[]>(
    "/api/scenarios",
    { params },
  );
  return response.data;
}

export async function createScenario(
  payload: ScenarioCreate,
): Promise<ScenarioRead> {
  const response = await apiClient.post<ScenarioRead>(
    "/api/scenarios",
    payload,
  );
  return response.data;
}

export async function updateScenario(
  id: string,
  payload: ScenarioUpdate,
): Promise<ScenarioRead> {
  const response = await apiClient.patch<ScenarioRead>(
    `/api/scenarios/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteScenario(id: string): Promise<void> {
  await apiClient.delete(`/api/scenarios/${id}`);
}
