/**
 * Client for the /api/scenario-shapes admin dictionary (PER-90).
 *
 * The list endpoint is consumed by the scenario editor on every page
 * load — kept in a long-lived React Query cache (5 min) since it
 * changes rarely.
 */

import { apiClient } from "@/api/client";
import type {
  ScenarioShapeCreate,
  ScenarioShapeRead,
  ScenarioShapeUpdate,
} from "@/types";

export async function listScenarioShapes(): Promise<ScenarioShapeRead[]> {
  const res = await apiClient.get<ScenarioShapeRead[]>("/api/scenario-shapes");
  return res.data;
}

export async function createScenarioShape(
  payload: ScenarioShapeCreate,
): Promise<ScenarioShapeRead> {
  const res = await apiClient.post<ScenarioShapeRead>(
    "/api/scenario-shapes",
    payload,
  );
  return res.data;
}

export async function updateScenarioShape(
  id: string,
  payload: ScenarioShapeUpdate,
): Promise<ScenarioShapeRead> {
  const res = await apiClient.patch<ScenarioShapeRead>(
    `/api/scenario-shapes/${id}`,
    payload,
  );
  return res.data;
}

export async function deleteScenarioShape(id: string): Promise<void> {
  await apiClient.delete(`/api/scenario-shapes/${id}`);
}
