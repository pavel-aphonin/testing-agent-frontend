import { apiClient } from "@/api/client";
import type {
  FeedbackStatus,
  FeedbackSubmit,
  FeedbackTicketRead,
  HelpArticleFull,
  HelpArticleSummary,
  HelpSectionInfo,
} from "@/types";

export async function listHelpSections(): Promise<HelpSectionInfo[]> {
  const r = await apiClient.get("/api/help/sections");
  return r.data;
}

export async function listHelpArticles(params?: {
  section?: string;
  q?: string;
}): Promise<HelpArticleSummary[]> {
  const r = await apiClient.get("/api/help/articles", { params });
  return r.data;
}

export async function popularHelpArticles(limit = 6): Promise<HelpArticleSummary[]> {
  const r = await apiClient.get("/api/help/articles/popular", { params: { limit } });
  return r.data;
}

export async function getHelpArticle(slug: string): Promise<HelpArticleFull> {
  const r = await apiClient.get(`/api/help/articles/${encodeURIComponent(slug)}`);
  return r.data;
}

export async function submitFeedback(payload: FeedbackSubmit): Promise<FeedbackTicketRead> {
  const r = await apiClient.post("/api/help/feedback", payload);
  return r.data;
}

export async function listFeedbackInbox(status?: FeedbackStatus): Promise<FeedbackTicketRead[]> {
  const r = await apiClient.get("/api/help/admin/feedback", {
    params: status ? { status } : undefined,
  });
  return r.data;
}

export async function updateFeedbackTicket(
  id: string,
  patch: { status?: FeedbackStatus; admin_notes?: string; external_id?: string },
): Promise<FeedbackTicketRead> {
  const r = await apiClient.patch(`/api/help/admin/feedback/${id}`, patch);
  return r.data;
}
