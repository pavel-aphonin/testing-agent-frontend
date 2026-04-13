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
