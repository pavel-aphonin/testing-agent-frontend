import { apiClient } from "./client";
import type {
  CustomDictionaryCreate,
  CustomDictionaryItemCreate,
  CustomDictionaryItemRead,
  CustomDictionaryItemUpdate,
  CustomDictionaryPermissionRead,
  CustomDictionaryRead,
  CustomDictionaryUpdate,
} from "@/types";

// Dictionaries
export async function listCustomDictionaries(workspaceId: string): Promise<CustomDictionaryRead[]> {
  const res = await apiClient.get("/api/custom-dictionaries", {
    params: { workspace_id: workspaceId },
  });
  return res.data;
}

export async function createCustomDictionary(payload: CustomDictionaryCreate): Promise<CustomDictionaryRead> {
  const res = await apiClient.post("/api/custom-dictionaries", payload);
  return res.data;
}

export async function updateCustomDictionary(id: string, payload: CustomDictionaryUpdate): Promise<CustomDictionaryRead> {
  const res = await apiClient.patch(`/api/custom-dictionaries/${id}`, payload);
  return res.data;
}

export async function deleteCustomDictionary(id: string): Promise<void> {
  await apiClient.delete(`/api/custom-dictionaries/${id}`);
}

// Items
export async function listDictionaryItems(dictId: string): Promise<CustomDictionaryItemRead[]> {
  const res = await apiClient.get(`/api/custom-dictionaries/${dictId}/items`);
  return res.data;
}

export async function createDictionaryItem(dictId: string, payload: CustomDictionaryItemCreate): Promise<CustomDictionaryItemRead> {
  const res = await apiClient.post(`/api/custom-dictionaries/${dictId}/items`, payload);
  return res.data;
}

export async function updateDictionaryItem(itemId: string, payload: CustomDictionaryItemUpdate): Promise<CustomDictionaryItemRead> {
  const res = await apiClient.patch(`/api/custom-dictionaries/items/${itemId}`, payload);
  return res.data;
}

export async function deleteDictionaryItem(itemId: string): Promise<void> {
  await apiClient.delete(`/api/custom-dictionaries/items/${itemId}`);
}

// Permissions (ACL)
export async function listDictionaryPermissions(dictId: string): Promise<CustomDictionaryPermissionRead[]> {
  const res = await apiClient.get(`/api/custom-dictionaries/${dictId}/permissions`);
  return res.data;
}

export async function upsertDictionaryPermission(
  dictId: string,
  payload: { user_id: string; can_view: boolean; can_edit: boolean },
): Promise<CustomDictionaryPermissionRead> {
  const res = await apiClient.put(`/api/custom-dictionaries/${dictId}/permissions`, payload);
  return res.data;
}

export async function removeDictionaryPermission(dictId: string, userId: string): Promise<void> {
  await apiClient.delete(`/api/custom-dictionaries/${dictId}/permissions/${userId}`);
}
