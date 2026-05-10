import { useQuery } from "@tanstack/react-query";
import { Badge, Tooltip, Typography } from "antd";

import { getWorkerStatus } from "@/api/worker";

const COLORS = {
  connected: "#52c41a",
  stale: "#faad14",
  unknown: "#bfbfbf",
} as const;

const LABELS = {
  connected: "Подключено",
  stale: "Связь потеряна",
  unknown: "Не подключено",
} as const;

const HINTS = {
  connected: "Worker отвечает — можно запускать исследования.",
  stale: "Worker не пингует backend дольше 15 секунд. Возможно, идёт долгий шаг или потеряна связь.",
  unknown: "Worker не запущен. Запустите make start в testing-agent-infra.",
} as const;

/**
 * Pulsing dot in the header that shows whether the explorer worker is alive.
 * Polls /api/worker/status every 5 seconds. The hint explains each state and
 * what the user should do.
 */
export function WorkerStatusBadge() {
  const { data } = useQuery({
    queryKey: ["worker-status"],
    queryFn: getWorkerStatus,
    refetchInterval: 5000,
    staleTime: 0,
  });

  const state = data?.status ?? "unknown";
  const color = COLORS[state];
  const label = LABELS[state];
  const hint = HINTS[state];

  return (
    <Tooltip title={hint} placement="bottom">
      <Typography.Text
        type="secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
      >
        <Badge
          color={color}
          status={state === "connected" ? "processing" : "default"}
        />
        {label}
      </Typography.Text>
    </Tooltip>
  );
}
