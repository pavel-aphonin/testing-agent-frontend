import { apiClient } from "@/api/client";

export interface WorkerStatus {
  status: "connected" | "stale" | "unknown";
  last_heartbeat_ago_sec: number | null;
}

export async function getWorkerStatus(): Promise<WorkerStatus> {
  const { data } = await apiClient.get<WorkerStatus>("/api/worker/status");
  return data;
}
