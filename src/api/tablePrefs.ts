import { apiClient } from "./client";

export interface TablePrefs {
  visible_columns?: string[];
  sort?: { col: string; dir: "asc" | "desc" } | null;
  filters?: Record<string, unknown>;
}

export async function getTablePrefs(tableKey: string): Promise<TablePrefs> {
  const res = await apiClient.get(`/api/me/table-prefs/${tableKey}`);
  return res.data ?? {};
}

export async function setTablePrefs(tableKey: string, prefs: TablePrefs): Promise<TablePrefs> {
  const res = await apiClient.put(`/api/me/table-prefs/${tableKey}`, prefs);
  return res.data;
}
