import { apiClient } from "./client";
import type {
  NotificationTypeRead,
  NotificationTypeCreate,
  NotificationTypeUpdate,
  WorkspaceNotificationSettingRead,
} from "@/types";

export async function listNotificationTypes(): Promise<NotificationTypeRead[]> {
  const res = await apiClient.get("/api/dictionaries/notification-types");
  return res.data;
}

export async function createNotificationType(payload: NotificationTypeCreate): Promise<NotificationTypeRead> {
  const res = await apiClient.post("/api/dictionaries/notification-types", payload);
  return res.data;
}

export async function updateNotificationType(id: string, payload: NotificationTypeUpdate): Promise<NotificationTypeRead> {
  const res = await apiClient.patch(`/api/dictionaries/notification-types/${id}`, payload);
  return res.data;
}

export async function deleteNotificationType(id: string): Promise<void> {
  await apiClient.delete(`/api/dictionaries/notification-types/${id}`);
}

// Per-workspace settings
export async function listWorkspaceNotifSettings(wsId: string): Promise<WorkspaceNotificationSettingRead[]> {
  const res = await apiClient.get(`/api/workspaces/${wsId}/notification-settings`);
  return res.data;
}

export async function setWorkspaceNotifSetting(
  wsId: string,
  payload: { notification_type_id: string; is_enabled: boolean },
): Promise<WorkspaceNotificationSettingRead> {
  const res = await apiClient.put(`/api/workspaces/${wsId}/notification-settings`, payload);
  return res.data;
}
