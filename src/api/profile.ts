import { apiClient } from "@/api/client";
import type { ChangePasswordRequest, CurrentUser } from "@/types";

export async function getMyProfile(): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>("/api/profile");
  return response.data;
}

export async function changeMyPassword(
  payload: ChangePasswordRequest,
): Promise<void> {
  await apiClient.post("/api/profile/change-password", payload);
}

export async function uploadMyAvatar(file: File): Promise<CurrentUser> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await apiClient.post("/api/profile/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function deleteMyAvatar(): Promise<CurrentUser> {
  const r = await apiClient.delete("/api/profile/avatar");
  return r.data;
}

/** Resolve the stored ``avatar_path`` into a browser-fetchable URL. */
export function avatarAssetUrl(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  // DB stores "avatars/<file>"; /avatar-assets/ mounts the inner folder.
  const clean = relPath.replace(/^avatars\//, "");
  return `${base}/avatar-assets/${clean}`;
}
