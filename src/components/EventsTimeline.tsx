import { Button, List, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type { RunStatus } from "@/types";

/**
 * Shared event shape — matches what RunProgress builds from snapshot
 * (historical events) merged with WebSocket frames (live events).
 */
export interface TimelineEvent {
  type:
    | "status_change"
    | "screen_discovered"
    | "edge_discovered"
    | "log"
    | "error";
  step_idx?: number | null;
  timestamp?: string | null;
  // status_change
  new_status?: RunStatus;
  // screen_discovered
  screen_id_hash?: string;
  screen_name?: string;
  is_new?: boolean;
  // edge_discovered
  source_screen_hash?: string;
  target_screen_hash?: string;
  action_type?: string;
  action_details?: { element?: string | null; value?: string | null } | null;
  // log / error
  message?: string;
}

const STATUS_COLOR: Record<RunStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

const PAGE_SIZE = 50;

interface Props {
  events: TimelineEvent[];
  language: string;
  /** Set true while WebSocket is still streaming so we auto-scroll on new events. */
  autoScroll?: boolean;
  /** Empty-state text. */
  emptyText: string;
}

/**
 * Virtualised events feed for the run progress / results page.
 *
 * Three behaviours from Pavel's brief:
 * 1. Pagination — initially show the last PAGE_SIZE events. A "Посмотреть
 *    предыдущие" button at the top loads the previous PAGE_SIZE.
 * 2. Virtualisation — react-virtuoso renders only the visible window.
 *    Without it 1000+ events freeze the page on scroll.
 * 3. Auto-scroll — when new events arrive AND we're already at the
 *    bottom, follow them. If the user scrolled up to read history,
 *    don't yank them back.
 */
export function EventsTimeline({ events, language, autoScroll = true, emptyText }: Props) {
  // How many of the most recent events to show. We keep an offset from the
  // END of the array (so when new live events arrive, the offset stays
  // anchored to "the latest").
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pre-filter: drop events that render as empty rows in the timeline.
  // EventLine returns null for screen_discovered with is_new=false (visit
  // count bumps), but the Virtuoso row wrapper still showed the timestamp
  // + an empty body — Pavel saw "two шаг 14 entries, one blank".
  const renderableEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.type === "screen_discovered" && e.is_new === false) return false;
      return true;
    });
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (renderableEvents.length <= visibleCount) return renderableEvents;
    return renderableEvents.slice(renderableEvents.length - visibleCount);
  }, [renderableEvents, visibleCount]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const atBottomRef = useRef(true);

  // Auto-scroll when new events arrive AND user hasn't scrolled away.
  useEffect(() => {
    if (!autoScroll) return;
    if (atBottomRef.current && visibleEvents.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: visibleEvents.length - 1,
        behavior: "smooth",
      });
    }
  }, [visibleEvents.length, autoScroll]);

  if (renderableEvents.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
        {emptyText}
      </div>
    );
  }

  const hasMore = visibleCount < renderableEvents.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {hasMore && (
        <div style={{ padding: 8, borderBottom: "1px solid #f0f0f0", textAlign: "center" }}>
          <Button
            size="small"
            type="link"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          >
            ↑ Посмотреть предыдущие ({renderableEvents.length - visibleCount} событий)
          </Button>
        </div>
      )}
      <Virtuoso
        ref={virtuosoRef}
        data={visibleEvents}
        atBottomStateChange={(atBottom) => {
          atBottomRef.current = atBottom;
        }}
        itemContent={(_, e) => <EventRow event={e} language={language} />}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  );
}

function EventRow({ event, language }: { event: TimelineEvent; language: string }) {
  const time = fmtTime(event.timestamp, language);
  return (
    <List.Item style={{ padding: "8px 12px", borderBottom: "1px solid #fafafa" }}>
      <div style={{ width: "100%" }}>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {time} · шаг {event.step_idx ?? 0}
        </Typography.Text>
        <br />
        <EventLine event={event} />
      </div>
    </List.Item>
  );
}

function fmtTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (lang.startsWith("ru")) return d.toLocaleTimeString("ru-RU", { hour12: false });
  return d.toLocaleTimeString();
}

function EventLine({ event }: { event: TimelineEvent }) {
  switch (event.type) {
    case "status_change":
      return (
        <span>
          <Tag color={STATUS_COLOR[event.new_status as RunStatus]}>
            {event.new_status === "running"
              ? "▶ Исследование начато"
              : event.new_status === "completed"
              ? "✓ Исследование завершено"
              : event.new_status === "failed"
              ? "✗ Ошибка"
              : event.new_status === "cancelled"
              ? "■ Отменено"
              : event.new_status}
          </Tag>
        </span>
      );
    case "screen_discovered": {
      // Only emit a UI line for genuinely new screens.
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
      return (
        <span>
          {event.action_type} {label ? <strong>«{label}»</strong> : ""}
          {value ? <code> «{value}»</code> : ""}
          {moved ? " → переход" : ""}
        </span>
      );
    }
    case "log":
      return <span>{event.message}</span>;
    case "error":
      return (
        <span style={{ color: "#cf1322" }}>
          ⚠ {event.message ?? "Ошибка"}
        </span>
      );
  }
}
