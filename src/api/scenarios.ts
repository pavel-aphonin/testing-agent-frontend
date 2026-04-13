import { apiClient } from "@/api/client";
import type { ScenarioCreate, ScenarioRead, ScenarioUpdate } from "@/types";

export async function listScenarios(): Promise<ScenarioRead[]> {
  const response = await apiClient.get<ScenarioRead[]>(
    "/api/scenarios",
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
