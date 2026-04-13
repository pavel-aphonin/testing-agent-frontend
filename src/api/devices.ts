import { apiClient } from "@/api/client";
import type {
  DeviceConfigCreate,
  DeviceConfigRead,
  SimulatorConfig,
} from "@/types";

export async function listActiveDevices(): Promise<DeviceConfigRead[]> {
  const resp = await apiClient.get<DeviceConfigRead[]>("/api/devices");
  return resp.data;
}

export async function listAllDevices(): Promise<DeviceConfigRead[]> {
  const resp = await apiClient.get<DeviceConfigRead[]>("/api/admin/devices");
  return resp.data;
}

export async function getAvailableConfigs(): Promise<SimulatorConfig> {
  const resp = await apiClient.get<SimulatorConfig>(
    "/api/admin/devices/available",
  );
  return resp.data;
}

export async function createDeviceConfig(
  payload: DeviceConfigCreate,
): Promise<DeviceConfigRead> {
  const resp = await apiClient.post<DeviceConfigRead>(
    "/api/admin/devices",
    payload,
  );
  return resp.data;
}

export async function toggleDeviceConfig(
  id: string,
  isActive: boolean,
): Promise<DeviceConfigRead> {
  const resp = await apiClient.patch<DeviceConfigRead>(
    `/api/admin/devices/${id}`,
    { is_active: isActive },
  );
  return resp.data;
}

export async function deleteDeviceConfig(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/devices/${id}`);
}
