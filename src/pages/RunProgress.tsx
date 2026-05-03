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

import { BootProgress } from "@/components/BootProgress";
import { EventsTimeline, type TimelineEvent } from "@/components/EventsTimeline";
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
    /** V2-flow only — populated when the worker auto-provisioned a simulator. */
    device_type: string | null;
    os_version: string | null;
    app_file_path: string | null;
    platform: string | null;
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
  first_seen_at: string | null;
}

interface EdgeSummary {
  id: number;
  source_screen_hash: string;
  target_screen_hash: string;
  action_type: string;
  action_details: { element?: string | null; value?: string | null } | null;
  step_idx: number;
  success: boolean;
  created_at: string | null;
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

  // Build a unified timeline that includes both the historical events
  // reconstructed from the snapshot (so a user landing on the page after
  // the run has been going for a while doesn't see an empty list) and
  // the live events from the WebSocket. Deduplicated by step_idx + type.
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const items: TimelineEvent[] = [];

    if (snapshot) {
      // 1. Status change: "running"
      if (snapshot.run.started_at) {
        items.push({
          type: "status_change",
          new_status: "running",
          step_idx: 0,
          timestamp: snapshot.run.started_at,
        });
      }
      // 2. Each screen as a screen_discovered event (is_new=true)
      snapshot.screens.forEach((s) => {
        items.push({
          type: "screen_discovered",
          step_idx: 0,
          timestamp: s.first_seen_at,
          screen_id_hash: s.screen_id_hash,
          screen_name: s.name,
          is_new: true,
        });
      });
      // 3. Each edge as an edge_discovered event
      snapshot.edges.forEach((e) => {
        items.push({
          type: "edge_discovered",
          step_idx: e.step_idx,
          timestamp: e.created_at,
          source_screen_hash: e.source_screen_hash,
          target_screen_hash: e.target_screen_hash,
          action_type: e.action_type,
          action_details: e.action_details,
        });
      });
      // 4. Terminal status if applicable
      if (snapshot.run.finished_at && snapshot.run.status !== "running") {
        items.push({
          type: "status_change",
          new_status: snapshot.run.status,
          timestamp: snapshot.run.finished_at,
        });
      }
    }

    // Append live events (skip those already in the snapshot — heuristic:
    // edge_discovered with step_idx already present from snapshot is a dup)
    const seenEdgeSteps = new Set(
      snapshot?.edges.map((e) => e.step_idx) ?? [],
    );
    const seenScreenHashes = new Set(
      snapshot?.screens.map((s) => s.screen_id_hash) ?? [],
    );
    events.forEach((e) => {
      if (e.type === "edge_discovered" && e.step_idx != null && seenEdgeSteps.has(e.step_idx)) {
        return; // already in snapshot
      }
      if (
        e.type === "screen_discovered"
        && e.is_new
        && e.screen_id_hash
        && seenScreenHashes.has(e.screen_id_hash)
      ) {
        return;
      }
      items.push(e as TimelineEvent);
    });

    // Sort by timestamp; events without timestamp keep insertion order
    items.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Deduplicate status_change events: the worker can emit "running" twice —
    // once when the simulator boots, once when exploration starts. Same for
    // any terminal status that races with the snapshot's finished_at-based
    // item. Keep only the FIRST occurrence of each (type, new_status) pair.
    const seenStatusChange = new Set<string>();
    const deduped: TimelineEvent[] = [];
    for (const item of items) {
      if (item.type === "status_change" && item.new_status) {
        const key = item.new_status;
        if (seenStatusChange.has(key)) continue;
        seenStatusChange.add(key);
      }
      deduped.push(item);
    }

    return deduped;
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
        {/* PER-48: synthetic/real badge removed — worker only does
            real runs now, the badge would always show "Real" and
            adds visual noise. */}
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

      {/* PER-44: visual stepper for the simulator-boot phase. Hidden
          automatically once exploration starts (any event with
          step_idx > 0) or the run reaches a terminal state. */}
      <BootProgress events={timelineEvents} status={currentStatus} />

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
                styles={{ body: { padding: 0, height: "calc(100% - 38px)" } }}
              >
                <EventsTimeline
                  events={timelineEvents}
                  language={lang}
                  autoScroll={!TERMINAL_STATUSES.has(currentStatus)}
                  emptyText={t("runProgress.noEvents")}
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
