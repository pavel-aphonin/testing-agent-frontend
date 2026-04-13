import { apiClient } from "@/api/client";
import type {
  LLMModelAdmin,
  LLMModelCreate,
  LLMModelPublic,
  LLMModelUpdate,
} from "@/types";

// Public list — what testers see in the New Run modal dropdown.
export async function listActiveModels(): Promise<LLMModelPublic[]> {
  const response = await apiClient.get<LLMModelPublic[]>("/api/models");
  return response.data;
}

// Admin CRUD ----------------------------------------------------------------

export async function listAllModels(): Promise<LLMModelAdmin[]> {
  const response = await apiClient.get<LLMModelAdmin[]>("/api/admin/models");
  return response.data;
}

export async function createModel(
  payload: LLMModelCreate,
): Promise<LLMModelAdmin> {
  const response = await apiClient.post<LLMModelAdmin>(
    "/api/admin/models",
    payload,
  );
  return response.data;
}

export async function updateModel(
  id: string,
  payload: LLMModelUpdate,
): Promise<LLMModelAdmin> {
  const response = await apiClient.patch<LLMModelAdmin>(
    `/api/admin/models/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteModel(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/models/${id}`);
}
