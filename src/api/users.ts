import { apiClient } from "@/api/client";
import type { AdminUser, AdminUserCreate } from "@/types";

export async function listAdminUsers(): Promise<AdminUser[]> {
  const response = await apiClient.get<AdminUser[]>("/api/admin/users");
  return response.data;
}

export async function createAdminUser(
  payload: AdminUserCreate,
): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(
    "/api/admin/users",
    payload,
  );
  return response.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/users/${id}`);
}
