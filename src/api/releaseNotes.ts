import { apiClient } from "@/api/client";
import type {
  ReleaseNoteFull,
  ReleaseNoteSummary,
  ReleaseNotesUnread,
} from "@/types";

export async function listReleaseNotes(params?: {
  date_from?: string;
  date_to?: string;
  include_drafts?: boolean;
}): Promise<ReleaseNoteSummary[]> {
  const r = await apiClient.get("/api/release-notes", { params });
  return r.data;
}

export async function getReleaseNote(version: string): Promise<ReleaseNoteFull> {
  const r = await apiClient.get(`/api/release-notes/${encodeURIComponent(version)}`);
  return r.data;
}

export async function getUnreadReleaseNotes(): Promise<ReleaseNotesUnread> {
  const r = await apiClient.get("/api/release-notes/unread");
  return r.data;
}

export async function dismissReleaseNote(noteId: string): Promise<void> {
  await apiClient.post(`/api/release-notes/${noteId}/dismiss`);
}

export async function dismissAllReleaseNotes(): Promise<void> {
  await apiClient.post("/api/release-notes/dismiss-all");
}
