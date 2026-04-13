import { apiClient } from "@/api/client";
import type { AgentSettings, AgentSettingsUpdate } from "@/types";

export async function getMySettings(): Promise<AgentSettings> {
  const response = await apiClient.get<AgentSettings>("/api/settings");
  return response.data;
}

export async function updateMySettings(
  payload: AgentSettingsUpdate,
): Promise<AgentSettings> {
  const response = await apiClient.patch<AgentSettings>(
    "/api/settings",
    payload,
  );
  return response.data;
}
