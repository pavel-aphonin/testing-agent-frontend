import { apiClient } from "@/api/client";
import type {
  KnowledgeDocumentCreate,
  KnowledgeDocumentDetail,
  KnowledgeDocumentSummary,
  KnowledgeQuery,
  KnowledgeQueryResponse,
} from "@/types";

export async function listKnowledgeDocuments(): Promise<
  KnowledgeDocumentSummary[]
> {
  const response = await apiClient.get<KnowledgeDocumentSummary[]>(
    "/api/admin/knowledge/documents",
  );
  return response.data;
}

export async function getKnowledgeDocument(
  id: string,
): Promise<KnowledgeDocumentDetail> {
  const response = await apiClient.get<KnowledgeDocumentDetail>(
    `/api/admin/knowledge/documents/${id}`,
  );
  return response.data;
}

export async function createKnowledgeDocument(
  payload: KnowledgeDocumentCreate,
): Promise<KnowledgeDocumentSummary> {
  const response = await apiClient.post<KnowledgeDocumentSummary>(
    "/api/admin/knowledge/documents",
    payload,
  );
  return response.data;
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/knowledge/documents/${id}`);
}

export async function queryKnowledgeBase(
  payload: KnowledgeQuery,
): Promise<KnowledgeQueryResponse> {
  const response = await apiClient.post<KnowledgeQueryResponse>(
    "/api/admin/knowledge/query",
    payload,
  );
  return response.data;
}
