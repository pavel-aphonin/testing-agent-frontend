import { apiClient } from "./client";
import type {
  AppInstallationRead,
  AppPackageRead,
  AppPackageVersionRead,
  AppReviewRead,
} from "@/types";

// Catalog
export async function searchStore(q?: string, category?: string): Promise<AppPackageRead[]> {
  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (category) params.category = category;
  const res = await apiClient.get("/api/apps/store", { params });
  return res.data;
}

export async function getPackage(id: string): Promise<AppPackageRead> {
  const res = await apiClient.get(`/api/apps/${id}`);
  return res.data;
}

export async function listVersions(id: string): Promise<AppPackageVersionRead[]> {
  const res = await apiClient.get(`/api/apps/${id}/versions`);
  return res.data;
}

export async function myPackages(): Promise<AppPackageRead[]> {
  const res = await apiClient.get("/api/apps/mine");
  return res.data;
}

export async function adminAllPackages(): Promise<AppPackageRead[]> {
  const res = await apiClient.get("/api/apps/admin/all");
  return res.data;
}

export async function adminPendingPackages(): Promise<AppPackageRead[]> {
  const res = await apiClient.get("/api/apps/admin/pending");
  return res.data;
}

// Upload
export async function uploadBundle(
  file: File,
  opts: { is_public?: boolean; owner_workspace_id?: string; submit_for_review?: boolean } = {},
): Promise<AppPackageRead> {
  const fd = new FormData();
  fd.append("file", file);
  const params = {
    is_public: opts.is_public ?? false,
    owner_workspace_id: opts.owner_workspace_id,
    submit_for_review: opts.submit_for_review ?? true,
  };
  const res = await apiClient.post("/api/apps/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    params,
  });
  return res.data;
}

export async function submitForReview(id: string): Promise<AppPackageRead> {
  const res = await apiClient.post(`/api/apps/${id}/submit`);
  return res.data;
}

export async function approveOrReject(
  id: string,
  payload: { approved: boolean; rejection_reason?: string },
): Promise<AppPackageRead> {
  const res = await apiClient.post(`/api/apps/${id}/approve`, payload);
  return res.data;
}

export async function deletePackage(id: string): Promise<void> {
  await apiClient.delete(`/api/apps/${id}`);
}

// Reviews
export async function listReviews(id: string): Promise<AppReviewRead[]> {
  const res = await apiClient.get(`/api/apps/${id}/reviews`);
  return res.data;
}

export async function upsertReview(
  id: string,
  payload: { rating: number; text?: string },
): Promise<AppReviewRead> {
  const res = await apiClient.post(`/api/apps/${id}/reviews`, payload);
  return res.data;
}

export async function deleteReview(id: string): Promise<void> {
  await apiClient.delete(`/api/apps/${id}/reviews`);
}

// Bundle static file URL (iframe src + <img> for screenshots).
// Served by a no-auth StaticFiles mount — the HTML/JS/CSS is public
// code, the installation token gates the API calls the iframe makes.
export function bundleFileUrl(pkgCode: string, version: string, path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  const clean = path.replace(/^\/+/, "");
  return `${base}/app-bundles/${pkgCode}/${version}/${clean}`;
}

/** Absolute URL for a relative logo_path stored on the package. */
export function bundleAssetUrl(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  const clean = relPath.replace(/^\/+/, "");
  return `${base}/${clean}`;
}

// Installations (per workspace)
export async function listInstallations(wsId: string): Promise<AppInstallationRead[]> {
  const res = await apiClient.get(`/api/workspaces/${wsId}/apps`);
  return res.data;
}

export async function installApp(
  wsId: string,
  payload: {
    app_package_id: string;
    version_id?: string;
    settings?: Record<string, unknown>;
  },
): Promise<AppInstallationRead> {
  const res = await apiClient.post(`/api/workspaces/${wsId}/apps`, payload);
  return res.data;
}

export async function updateInstallation(
  wsId: string,
  instId: string,
  payload: {
    version_id?: string;
    settings?: Record<string, unknown>;
    is_enabled?: boolean;
  },
): Promise<AppInstallationRead> {
  const res = await apiClient.patch(`/api/workspaces/${wsId}/apps/${instId}`, payload);
  return res.data;
}

export async function uninstallApp(wsId: string, instId: string): Promise<void> {
  await apiClient.delete(`/api/workspaces/${wsId}/apps/${instId}`);
}

/** Audit log of install/update/uninstall events for a workspace. */
export async function listAppsHistory(wsId: string) {
  const res = await apiClient.get(`/api/workspaces/${wsId}/apps-history`);
  return res.data as import("@/types").AppInstallationAuditRead[];
}

/**
 * Replace the current user's per-installation UI prefs.
 * Known keys: hidden_from_sidebar, hidden_from_top_bar.
 * Unknown keys are preserved by the backend.
 */
export async function updateMyInstallationPrefs(
  wsId: string,
  instId: string,
  prefs: Record<string, unknown>,
): Promise<{ prefs: Record<string, unknown> }> {
  const res = await apiClient.put(
    `/api/workspaces/${wsId}/apps/${instId}/my-prefs`,
    { prefs },
  );
  return res.data;
}
