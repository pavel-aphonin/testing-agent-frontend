import { apiClient } from "./client";
import type { InvitationRead, NotificationRead } from "@/types";

export async function listNotifications(unreadOnly = false): Promise<NotificationRead[]> {
  const res = await apiClient.get("/api/notifications", {
    params: { unread_only: unreadOnly },
  });
  return res.data;
}

export async function unreadCount(): Promise<{ count: number }> {
  const res = await apiClient.get("/api/notifications/unread-count");
  return res.data;
}

export async function markRead(id: string): Promise<void> {
  await apiClient.post(`/api/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await apiClient.post("/api/notifications/read-all");
}

// Invitations
export async function listMyInvitations(pendingOnly = true): Promise<InvitationRead[]> {
  const res = await apiClient.get("/api/invitations/my", {
    params: { pending_only: pendingOnly },
  });
  return res.data;
}

export async function createInvitation(payload: {
  workspace_id: string;
  invitee_user_id: string;
  role?: string;
}): Promise<InvitationRead> {
  const res = await apiClient.post("/api/invitations", payload);
  return res.data;
}

export async function acceptInvitation(id: string): Promise<{ workspace_id: string }> {
  const res = await apiClient.post(`/api/invitations/${id}/accept`);
  return res.data;
}

export async function declineInvitation(id: string): Promise<void> {
  await apiClient.post(`/api/invitations/${id}/decline`);
}
