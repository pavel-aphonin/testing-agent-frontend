import { apiClient } from "./client";
import type {
  AttributeCreate,
  AttributeRead,
  AttributeUpdate,
  AttributeValueRead,
} from "@/types";

export async function listAttributes(appliesTo?: string): Promise<AttributeRead[]> {
  const params = appliesTo ? { applies_to: appliesTo } : {};
  const res = await apiClient.get("/api/dictionaries/attributes", { params });
  return res.data;
}

export async function createAttribute(payload: AttributeCreate): Promise<AttributeRead> {
  const res = await apiClient.post("/api/dictionaries/attributes", payload);
  return res.data;
}

export async function updateAttribute(id: string, payload: AttributeUpdate): Promise<AttributeRead> {
  const res = await apiClient.patch(`/api/dictionaries/attributes/${id}`, payload);
  return res.data;
}

export async function deleteAttribute(id: string): Promise<void> {
  await apiClient.delete(`/api/dictionaries/attributes/${id}`);
}

// Values
export async function listAttributeValues(
  entityType: string,
  entityId: string,
): Promise<AttributeValueRead[]> {
  const res = await apiClient.get("/api/attribute-values", {
    params: { entity_type: entityType, entity_id: entityId },
  });
  return res.data;
}

export async function setAttributeValue(payload: {
  attribute_id: string;
  entity_type: "workspace" | "user_workspace";
  entity_id: string;
  value: unknown;
}): Promise<AttributeValueRead> {
  const res = await apiClient.put("/api/attribute-values", payload);
  return res.data;
}
