import { apiClient as client } from "./client";
import type { PermissionsRegistry, RoleCreate, RoleRead, RoleUpdate } from "@/types";

export async function listRoles(): Promise<RoleRead[]> {
  const res = await client.get("/api/dictionaries/roles");
  return res.data;
}

export async function getPermissionsRegistry(): Promise<PermissionsRegistry> {
  const res = await client.get("/api/dictionaries/roles/permissions");
  return res.data;
}

export async function createRole(payload: RoleCreate): Promise<RoleRead> {
  const res = await client.post("/api/dictionaries/roles", payload);
  return res.data;
}

export async function updateRole(id: string, payload: RoleUpdate): Promise<RoleRead> {
  const res = await client.patch(`/api/dictionaries/roles/${id}`, payload);
  return res.data;
}

export async function deleteRole(id: string): Promise<void> {
  await client.delete(`/api/dictionaries/roles/${id}`);
}
