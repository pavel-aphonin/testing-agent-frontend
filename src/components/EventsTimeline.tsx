import { Button, List, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {t("events.loadPrevious", { count: renderableEvents.length - visibleCount })}
          </Button>
        </div>
      )}
      <Virtuoso
        ref={virtuosoRef}
        data={visibleEvents}
        atBottomStateChange={(atBottom) => {
          atBottomRef.current = atBottom;
        }}
        itemContent={(_, e) => <EventRow event={e} language={language} t={t} />}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  );
}

function EventRow({
  event, language, t,
}: {
  event: TimelineEvent;
  language: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const time = fmtTime(event.timestamp, language);
  return (
    <List.Item style={{ padding: "8px 12px", borderBottom: "1px solid #fafafa" }}>
      <div style={{ width: "100%" }}>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {time} · {t("events.stepLabel", { idx: event.step_idx ?? 0 })}
        </Typography.Text>
        <br />
        <EventLine event={event} t={t} />
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

function EventLine({
  event, t,
}: {
  event: TimelineEvent;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  switch (event.type) {
    case "status_change": {
      // PER-45: was inline ternary on Russian strings — now driven by
      // i18n so the language switcher reaches the live log too.
      const statusKey = event.new_status as RunStatus | undefined;
      const label = statusKey && ["running", "completed", "failed", "cancelled"].includes(statusKey)
        ? t(`events.status.${statusKey}`)
        : (event.new_status ?? "");
      return (
        <span>
          <Tag color={STATUS_COLOR[event.new_status as RunStatus]}>{label}</Tag>
        </span>
      );
    }
    case "screen_discovered": {
      // Only emit a UI line for genuinely new screens.
      if (event.is_new === false) return null;
      return <span>{t("events.screenDiscovered", { name: event.screen_name })}</span>;
    }
    case "edge_discovered": {
      const details = event.action_details ?? {};
      const label = details.element || undefined;
      const value = details.value || undefined;
      const moved = event.source_screen_hash !== event.target_screen_hash;
      const transition = moved ? ` ${t("events.actions.transition")}` : "";

      if (event.action_type === "input") {
        const truncated =
          value && value.length > 40 ? value.slice(0, 37) + "…" : value;
        return (
          <span>
            {t("events.actions.input")}{" "}
            {truncated
              ? <code>«{truncated}»</code>
              : t("events.actions.fallbackInputValue")}
            {label
              ? <> {t("events.actions.inputTo")} <strong>«{label}»</strong></>
              : ` ${t("events.actions.fallbackInputField")}`}
            {transition}
          </span>
        );
      }
      if (event.action_type === "tap") {
        return (
          <span>
            {t("events.actions.tap")}{" "}
            {label
              ? <strong>«{label}»</strong>
              : t("events.actions.fallbackTapLabel")}
            {transition}
          </span>
        );
      }
      if (event.action_type === "swipe") {
        return (
          <span>
            {t("events.actions.swipe")}{value ? ` ${value}` : ""}
            {label ? <> {t("events.actions.swipeOn")} <strong>«{label}»</strong></> : ""}
          </span>
        );
      }
      return (
        <span>
          {event.action_type} {label ? <strong>«{label}»</strong> : ""}
          {value ? <code> «{value}»</code> : ""}
          {moved ? ` ${t("events.actions.transitionGeneric")}` : ""}
        </span>
      );
    }
    case "log":
      return <span>{event.message}</span>;
    case "error":
      return (
        <span style={{ color: "#cf1322" }}>
          ⚠ {event.message ?? t("events.errorFallback")}
        </span>
      );
  }
}
