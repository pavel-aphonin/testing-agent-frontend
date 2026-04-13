import { apiClient } from "@/api/client";
import type {
  HfDownloadRequest,
  HfDownloadStarted,
  HfFile,
  HfRepoSummary,
} from "@/types";

// Admin-only HuggingFace model browser API. Mirrors
// testing-agent-backend/app/api/hf_models.py

export async function searchHfModels(
  q: string,
  limit = 20,
): Promise<HfRepoSummary[]> {
  const response = await apiClient.get<HfRepoSummary[]>(
    "/api/admin/models/hf/search",
    { params: { q, limit } },
  );
  return response.data;
}

export async function listHfRepoFiles(repoId: string): Promise<HfFile[]> {
  // repoId comes in as "owner/name". The backend route takes them as two
  // path segments, so we pass them literally — no URL encoding of the
  // slash or the name, because the segments themselves don't contain
  // slashes.
  const [owner, name] = repoId.split("/");
  const response = await apiClient.get<HfFile[]>(
    `/api/admin/models/hf/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/files`,
  );
  return response.data;
}

export async function startHfDownload(
  payload: HfDownloadRequest,
): Promise<HfDownloadStarted> {
  const response = await apiClient.post<HfDownloadStarted>(
    "/api/admin/models/hf/download",
    payload,
  );
  return response.data;
}
