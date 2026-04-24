import { apiClient } from "@/api/client";
import type {
  DashboardFull,
  DashboardSummary,
  DashboardWidgetRead,
  DatasourceMetadata,
  WidgetDataResponse,
  WidgetPackageCreate,
  WidgetPackageRead,
  WidgetPackageSource,
  WidgetPackageUpdate,
  WidgetTemplateRead,
  WidgetType,
} from "@/types";

export async function listDashboards(wsId: string): Promise<DashboardSummary[]> {
  const r = await apiClient.get(`/api/workspaces/${wsId}/dashboards`);
  return r.data;
}

export async function getDashboard(id: string): Promise<DashboardFull> {
  const r = await apiClient.get(`/api/dashboards/${id}`);
  return r.data;
}

export async function createDashboard(
  wsId: string,
  payload: { name: string; description?: string; icon?: string },
): Promise<DashboardSummary> {
  const r = await apiClient.post(`/api/workspaces/${wsId}/dashboards`, payload);
  return r.data;
}

export async function updateDashboard(
  id: string,
  patch: { name?: string; description?: string; icon?: string },
): Promise<DashboardSummary> {
  const r = await apiClient.patch(`/api/dashboards/${id}`, patch);
  return r.data;
}

export async function deleteDashboard(id: string): Promise<void> {
  await apiClient.delete(`/api/dashboards/${id}`);
}

export async function addWidget(
  dashId: string,
  payload: Partial<Omit<DashboardWidgetRead, "id" | "dashboard_id">> & {
    widget_type: WidgetType;
  },
): Promise<DashboardWidgetRead> {
  const r = await apiClient.post(`/api/dashboards/${dashId}/widgets`, payload);
  return r.data;
}

export async function updateWidget(
  widgetId: string,
  patch: Partial<DashboardWidgetRead>,
): Promise<DashboardWidgetRead> {
  const r = await apiClient.patch(`/api/widgets/${widgetId}`, patch);
  return r.data;
}

export async function deleteWidget(widgetId: string): Promise<void> {
  await apiClient.delete(`/api/widgets/${widgetId}`);
}

export async function saveLayout(
  dashId: string,
  items: { id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }[],
): Promise<DashboardWidgetRead[]> {
  const r = await apiClient.put(`/api/dashboards/${dashId}/layout`, { items });
  return r.data;
}

export async function getWidgetData(widgetId: string): Promise<WidgetDataResponse> {
  const r = await apiClient.get(`/api/widgets/${widgetId}/data`);
  return r.data;
}

/** Grouped datasource catalog used by the widget settings dropdown. */
export async function listDatasources(): Promise<{
  groups: { code: string; name: string }[];
  items: DatasourceMetadata[];
}> {
  const r = await apiClient.get(`/api/widgets/datasources`);
  return r.data;
}

export interface DashboardPermissionRead {
  user_id: string;
  user_email: string | null;
  level: "view" | "edit";
}

export async function listDashboardPermissions(
  dashId: string,
): Promise<DashboardPermissionRead[]> {
  const r = await apiClient.get(`/api/dashboards/${dashId}/permissions`);
  return r.data;
}

/* ── Widget templates ──────────────────────────────────────────── */

export async function listWidgetTemplates(
  wsId: string,
): Promise<WidgetTemplateRead[]> {
  const r = await apiClient.get(`/api/workspaces/${wsId}/widget-templates`);
  return r.data;
}

export async function createWidgetTemplate(
  wsId: string,
  payload: {
    name: string;
    description?: string;
    icon?: string;
    widget_type: WidgetType;
    datasource_code?: string | null;
    datasource_params?: Record<string, unknown> | null;
    chart_options?: Record<string, unknown> | null;
    default_w?: number;
    default_h?: number;
  },
): Promise<WidgetTemplateRead> {
  const r = await apiClient.post(
    `/api/workspaces/${wsId}/widget-templates`,
    payload,
  );
  return r.data;
}

export async function updateWidgetTemplate(
  id: string,
  patch: Partial<WidgetTemplateRead>,
): Promise<WidgetTemplateRead> {
  const r = await apiClient.patch(`/api/widget-templates/${id}`, patch);
  return r.data;
}

export async function deleteWidgetTemplate(id: string): Promise<void> {
  await apiClient.delete(`/api/widget-templates/${id}`);
}

export async function addWidgetFromTemplate(
  dashId: string,
  templateId: string,
): Promise<DashboardWidgetRead> {
  const r = await apiClient.post(
    `/api/dashboards/${dashId}/widgets/from-template/${templateId}`,
  );
  return r.data;
}


export async function grantDashboardPermission(
  dashId: string,
  userId: string,
  level: "view" | "edit",
): Promise<void> {
  await apiClient.put(`/api/dashboards/${dashId}/permissions/${userId}`, { level });
}

export async function revokeDashboardPermission(
  dashId: string,
  userId: string,
): Promise<void> {
  await apiClient.delete(`/api/dashboards/${dashId}/permissions/${userId}`);
}

/* ── Widget packages (Phase 3b) ────────────────────────────────── */

export async function listWidgetPackages(
  wsId: string,
  onlyActive = false,
): Promise<WidgetPackageRead[]> {
  const r = await apiClient.get(`/api/workspaces/${wsId}/widget-packages`, {
    params: { only_active: onlyActive },
  });
  return r.data;
}

export async function getWidgetPackageSource(
  packageId: string,
): Promise<WidgetPackageSource> {
  const r = await apiClient.get(`/api/widget-packages/${packageId}/source`);
  return r.data;
}

export async function createWidgetPackage(
  wsId: string,
  payload: WidgetPackageCreate,
): Promise<WidgetPackageRead> {
  const r = await apiClient.post(
    `/api/workspaces/${wsId}/widget-packages`,
    payload,
  );
  return r.data;
}

export async function updateWidgetPackage(
  id: string,
  patch: WidgetPackageUpdate,
): Promise<WidgetPackageRead> {
  const r = await apiClient.patch(`/api/widget-packages/${id}`, patch);
  return r.data;
}

export async function deleteWidgetPackage(id: string): Promise<void> {
  await apiClient.delete(`/api/widget-packages/${id}`);
}
