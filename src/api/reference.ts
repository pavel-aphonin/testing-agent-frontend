import { apiClient } from "./client";

export interface RefRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  // Optional fields — only some ref tables have them.
  platform_code?: string;
  platform_scope?: string;
  description?: string | null;
  is_system?: boolean;
  sort_order?: number;
  /** App-category rows carry an emoji/glyph shown as chip prefix. */
  icon?: string | null;
}

export async function listRef(kind: string, params: Record<string, string> = {}): Promise<RefRow[]> {
  const res = await apiClient.get(`/api/reference/${kind}`, { params });
  return res.data;
}

export async function createRef(kind: string, payload: Record<string, unknown>): Promise<RefRow> {
  const res = await apiClient.post(`/api/reference/${kind}`, payload);
  return res.data;
}

export async function updateRef(kind: string, id: string, payload: Record<string, unknown>): Promise<RefRow> {
  const res = await apiClient.patch(`/api/reference/${kind}/${id}`, payload);
  return res.data;
}

export async function deleteRef(kind: string, id: string): Promise<void> {
  await apiClient.delete(`/api/reference/${kind}/${id}`);
}
