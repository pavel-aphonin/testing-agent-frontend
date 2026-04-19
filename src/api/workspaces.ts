import { apiClient } from "./client";
import type { WorkspaceBrief, WorkspaceRead, WorkspaceMemberRead } from "@/types";

export async function myWorkspaces(): Promise<WorkspaceBrief[]> {
  const res = await apiClient.get("/api/workspaces/my");
  return res.data;
}

export async function getWorkspace(id: string): Promise<WorkspaceRead> {
  const res = await apiClient.get(`/api/workspaces/${id}`);
  return res.data;
}

export async function createWorkspace(payload: {
  code: string;
  name: string;
  description?: string;
}): Promise<WorkspaceRead> {
  const res = await apiClient.post("/api/workspaces", payload);
  return res.data;
}

export async function updateWorkspace(
  id: string,
  payload: { name?: string; description?: string },
): Promise<WorkspaceRead> {
  const res = await apiClient.patch(`/api/workspaces/${id}`, payload);
  return res.data;
}

// Members
export async function listMembers(wsId: string): Promise<WorkspaceMemberRead[]> {
  const res = await apiClient.get(`/api/workspaces/${wsId}/members`);
  return res.data;
}

export async function addMember(
  wsId: string,
  payload: { user_id: string; role?: string },
): Promise<WorkspaceMemberRead> {
  const res = await apiClient.post(`/api/workspaces/${wsId}/members`, payload);
  return res.data;
}

export async function removeMember(wsId: string, userId: string): Promise<void> {
  await apiClient.delete(`/api/workspaces/${wsId}/members/${userId}`);
}

// Admin
export async function adminListWorkspaces(): Promise<WorkspaceRead[]> {
  const res = await apiClient.get("/api/admin/workspaces");
  return res.data;
}

export async function archiveWorkspace(id: string): Promise<WorkspaceRead> {
  const res = await apiClient.post(`/api/admin/workspaces/${id}/archive`);
  return res.data;
}

export async function restoreWorkspace(id: string): Promise<WorkspaceRead> {
  const res = await apiClient.post(`/api/admin/workspaces/${id}/restore`);
  return res.data;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/workspaces/${id}`);
}

export async function uploadWorkspaceLogo(
  wsId: string,
  file: File,
): Promise<WorkspaceRead> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiClient.post(`/api/workspaces/${wsId}/logo`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export function workspaceLogoUrl(wsId: string, hasLogo: boolean | string | null): string | null {
  if (!hasLogo) return null;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${base}/api/workspaces/${wsId}/logo`;
}
