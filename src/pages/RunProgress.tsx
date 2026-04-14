import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  List,
  Row,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { LiveMirror } from "@/components/LiveMirror";
import { useAuthStore } from "@/store/auth";
import type { RunStatus } from "@/types";

interface SnapshotEvent {
  type: "snapshot";
  run: {
    id: string;
    status: RunStatus;
    title: string | null;
    bundle_id: string;
    mode: string;
    created_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
    stats: Record<string, unknown> | null;
  };
  screens: ScreenSummary[];
  edges: EdgeSummary[];
}

interface ScreenSummary {
  id: number;
  screen_id_hash: string;
  name: string;
  visit_count: number;
  screenshot_path: string | null;
}

interface EdgeSummary {
  id: number;
  source_screen_hash: string;
  target_screen_hash: string;
  action_type: string;
  step_idx: number;
  success: boolean;
}

interface LiveEvent {
  type:
    | "status_change"
    | "screen_discovered"
    | "edge_discovered"
    | "log"
    | "error"
    | "stats_update";
  step_idx?: number;
  timestamp?: string;
  new_status?: RunStatus;
  screen_id_hash?: string;
  screen_name?: string;
  is_new?: boolean;
  source_screen_hash?: string;
  target_screen_hash?: string;
  action_type?: string;
  action_details?: { element?: string | null; value?: string | null } | null;
  message?: string;
  stats?: Record<string, unknown>;
}

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** DD.MM.YYYY HH:MM:SS for ru, locale toLocaleString otherwise. */
function fmtDateTime(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (lang.startsWith("ru")) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("ru-RU", { hour12: false });
    return `${day}.${month}.${year} ${time}`;
  }
  return d.toLocaleString();
}

function fmtTime(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (lang.startsWith("ru")) return d.toLocaleTimeString("ru-RU", { hour12: false });
  return d.toLocaleTimeString();
}

const STATUS_COLOR: Record<RunStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

function buildWebSocketUrl(runId: string, token: string): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  // Convert http(s)://host -> ws(s)://host
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/ws/runs/${runId}?token=${encodeURIComponent(token)}`;
}

export function RunProgress() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id: runId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const [snapshot, setSnapshot] = useState<SnapshotEvent | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connState, setConnState] = useState<
    "connecting" | "open" | "closed" | "error"
  >("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!runId || !token) return;

    const url = buildWebSocketUrl(runId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnState("open");

    ws.onmessage = (msgEvent) => {
      try {
        const parsed = JSON.parse(msgEvent.data);
        if (parsed.type === "snapshot") {
          setSnapshot(parsed as SnapshotEvent);
        } else {
          setEvents((prev) => [...prev, parsed as LiveEvent]);
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      setConnState("error");
      setErrorMsg(t("runProgress.wsError"));
    };

    ws.onclose = (e) => {
      setConnState("closed");
      if (e.code !== 1000 && e.reason) {
        setErrorMsg(e.reason);
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [runId, token]);

  // Derive the current run state from snapshot + status_change events.
  const currentStatus: RunStatus = useMemo(() => {
    if (!snapshot) return "pending";
    const lastStatusChange = [...events]
      .reverse()
      .find((e) => e.type === "status_change" && e.new_status);
    return (lastStatusChange?.new_status ?? snapshot.run.status) as RunStatus;
  }, [snapshot, events]);

  // Aggregate screens (snapshot + screen_discovered events, deduped by hash).
  const allScreens = useMemo(() => {
    const map = new Map<string, { name: string; hash: string }>();
    snapshot?.screens.forEach((s) =>
      map.set(s.screen_id_hash, { name: s.name, hash: s.screen_id_hash }),
    );
    events.forEach((e) => {
      if (e.type === "screen_discovered" && e.screen_id_hash) {
        map.set(e.screen_id_hash, {
          name: e.screen_name ?? "(unnamed)",
          hash: e.screen_id_hash,
        });
      }
    });
    return Array.from(map.values());
  }, [snapshot, events]);

  // Edges count (snapshot + edge_discovered events).
  const edgesCount = useMemo(() => {
    const fromSnapshot = snapshot?.edges.length ?? 0;
    const fromLive = events.filter((e) => e.type === "edge_discovered").length;
    return fromSnapshot + fromLive;
  }, [snapshot, events]);

  const latestStats = useMemo(() => {
    const lastStatsUpdate = [...events]
      .reverse()
      .find((e) => e.type === "stats_update" && e.stats);
    return lastStatsUpdate?.stats ?? snapshot?.run.stats ?? null;
  }, [snapshot, events]);

  if (!runId) {
    return <Alert type="error" message={t("runProgress.noRunId")} />;
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/runs")}>
          {t("common.back")}
        </Button>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {snapshot?.run.title
            ? snapshot.run.title
            : snapshot?.run.created_at
            ? `Запуск от ${fmtDateTime(snapshot.run.created_at, lang)}`
            : t("runProgress.title")}
        </Typography.Title>
        <Tag color={STATUS_COLOR[currentStatus]}>{t(`runStatus.${currentStatus}`)}</Tag>
        {/* Connection indicator only matters while the run is active. After
            the run reaches a terminal state, the WebSocket stays open but
            no events will arrive — showing "● Подключено" misleads the
            user into thinking something is still happening. */}
        {!TERMINAL_STATUSES.has(currentStatus) && (
          <Tag color={connState === "open" ? "green" : "default"}>
            {connState === "open"
              ? `● ${t("runProgress.wsConnected")}`
              : connState === "connecting"
              ? "Подключение…"
              : "Соединение разорвано"}
          </Tag>
        )}
      </div>

      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {snapshot && (
        <Card style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t("runProgress.bundle")}>
              {snapshot.run.bundle_id}
            </Descriptions.Item>
            <Descriptions.Item label={t("runProgress.mode")}>{snapshot.run.mode}</Descriptions.Item>
            <Descriptions.Item label={t("runProgress.started")}>
              {fmtDateTime(snapshot.run.started_at, lang)}
            </Descriptions.Item>
            <Descriptions.Item label={t("runProgress.finished")}>
              {fmtDateTime(snapshot.run.finished_at, lang)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Row gutter={16}>
        {/* Left column: stats + screens + live events */}
        <Col xs={24} lg={16}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title={t("runProgress.screensDiscovered")}
                  value={allScreens.length}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title={t("runProgress.edges")} value={edgesCount} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={t("runProgress.currentStep")}
                  value={
                    latestStats && typeof latestStats.step === "number"
                      ? `${latestStats.step} / ${latestStats.max_steps ?? "?"}`
                      : "—"
                  }
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card
                title={t("runResults.screens")}
                size="small"
                style={{ height: 480 }}
              >
                <List
                  size="small"
                  dataSource={allScreens}
                  locale={{ emptyText: t("runProgress.noEvents") }}
                  style={{ maxHeight: 420, overflowY: "auto" }}
                  renderItem={(item, idx) => (
                    <List.Item>
                      <Typography.Text strong>
                        {idx + 1}. {item.name}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        code
                        style={{ fontSize: 11 }}
                      >
                        {item.hash.slice(0, 24)}…
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title={t("runProgress.events")}
                size="small"
                style={{ height: 480 }}
              >
                <List
                  size="small"
                  dataSource={[...events].reverse()}
                  locale={{ emptyText: t("runProgress.noEvents") }}
                  style={{ maxHeight: 420, overflowY: "auto" }}
                  renderItem={(e, idx) => {
                    const time = fmtTime(e.timestamp, lang);
                    return (
                      <List.Item key={idx}>
                        <div style={{ width: "100%" }}>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 11 }}
                          >
                            {time} · шаг {e.step_idx ?? 0}
                          </Typography.Text>
                          <br />
                          <EventLine event={e} />
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Right column: live simulator mirror — only shown while the
            run is active. After completion the simulator is gone and the
            mirror would show a permanent loading spinner, which is just
            visual noise on the results-style view. */}
        {!TERMINAL_STATUSES.has(currentStatus) && (
          <Col xs={24} lg={8}>
            <Card
              title={t("liveMirror.title")}
              size="small"
              styles={{ body: { padding: 8 } }}
              style={{ position: "sticky", top: 16 }}
            >
              <LiveMirror runId={runId} />
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
}

function EventLine({ event }: { event: LiveEvent }) {
  switch (event.type) {
    case "status_change":
      return (
        <span>
          <Tag color={STATUS_COLOR[event.new_status as RunStatus]}>
            {event.new_status === "running" ? "▶ Исследование начато" :
             event.new_status === "completed" ? "✓ Исследование завершено" :
             event.new_status === "failed" ? "✗ Ошибка" :
             event.new_status}
          </Tag>
        </span>
      );
    case "screen_discovered": {
      // Only emit a UI line for genuinely new screens. Repeat visits
      // bump visit_count silently — printing "Обнаружил новый экран
      // Вход" five times for the same screen was confusing.
      if (event.is_new === false) return null;
      return (
        <span>
          🔍 Обнаружил новый экран: <strong>«{event.screen_name}»</strong>
        </span>
      );
    }
    case "edge_discovered": {
      const details = event.action_details ?? {};
      const label = details.element || undefined;
      const value = details.value || undefined;
      const moved = event.source_screen_hash !== event.target_screen_hash;

      if (event.action_type === "input") {
        const truncated =
          value && value.length > 40 ? value.slice(0, 37) + "…" : value;
        return (
          <span>
            ✏️ Ввожу {truncated ? <code>«{truncated}»</code> : "данные"}
            {label ? <> в поле <strong>«{label}»</strong></> : " в текстовое поле"}
            {moved ? " → перешёл на другой экран" : ""}
          </span>
        );
      }
      if (event.action_type === "tap") {
        return (
          <span>
            👆 Нажимаю {label ? <strong>«{label}»</strong> : "элемент"}
            {moved ? " → перешёл на другой экран" : ""}
          </span>
        );
      }
      if (event.action_type === "swipe") {
        return (
          <span>
            👉 Свайп{value ? ` ${value}` : ""}
            {label ? <> на <strong>«{label}»</strong></> : ""}
          </span>
        );
      }
      // Fallback for unexpected action types
      return (
        <span>
          {event.action_type} {label ? <strong>«{label}»</strong> : ""}
          {value ? <code> «{value}»</code> : ""}
          {moved ? " → переход" : ""}
        </span>
      );
    }
    case "stats_update": {
      const s = event.stats as Record<string, number> | undefined;
      if (!s) return null;
      return (
        <span style={{ color: "#888", fontSize: 11 }}>
          📊 Экранов: {s.screens} · Переходов: {s.edges} · Шаг {s.step}/{s.max_steps}
        </span>
      );
    }
    case "error":
      return (
        <span style={{ color: "#cf1322" }}>
          ❌ {event.message}
        </span>
      );
    case "log": {
      // Translate common engine messages to human-readable Russian
      const msg = event.message || "";
      const humanMsg =
        msg.includes("Creating simulator") ? "🔧 Создаю виртуальное устройство..." :
        msg.includes("Booting") ? "⏳ Запускаю устройство..." :
        msg.includes("Installing app") ? "📲 Устанавливаю приложение..." :
        msg.includes("Launching app") ? "🚀 Запускаю приложение..." :
        msg.includes("App launched") ? "✅ Приложение запущено, начинаю исследование" :
        msg.includes("Cleaning up") ? "🧹 Завершаю работу, удаляю устройство..." :
        msg.includes("Asking LLM") ? "🤔 Изучаю содержимое экрана..." :
        msg.includes("vision") ? "👁 Анализирую снимок экрана..." :
        msg.includes("wait") ? "⏳ Ожидаю загрузки экрана..." :
        msg;
      return <span>{humanMsg}</span>;
    }
    default:
      return <span>{event.type}</span>;
  }
}
