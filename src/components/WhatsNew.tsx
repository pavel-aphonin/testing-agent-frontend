import {
  CloseOutlined,
  FilterOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Empty,
  Modal,
  Space,
  Tag,
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { createContext, useContext, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

import {
  dismissAllReleaseNotes,
  dismissReleaseNote,
  getUnreadReleaseNotes,
  listReleaseNotes,
} from "@/api/releaseNotes";
import type { ReleaseNoteSummary } from "@/types";

/* ──────────────────────────────────────────────────────────────────────
 * Context: lets any component (footer, sidebar, anywhere) open the
 * modal without threading props through half the layout.
 * ─────────────────────────────────────────────────────────────────── */

interface WhatsNewCtx {
  open: () => void;
}
const WhatsNewContext = createContext<WhatsNewCtx | null>(null);

export function useWhatsNew() {
  const ctx = useContext(WhatsNewContext);
  return ctx ?? { open: () => {} };
}

/**
 * Host provider. Mount once near the app root — it owns the modal
 * state and exposes ``useWhatsNew()`` to everything inside.
 */
export function WhatsNewProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <WhatsNewContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <WhatsNewModal open={open} onClose={() => setOpen(false)} />
    </WhatsNewContext.Provider>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Sidebar plaque — icon on the left, "Что нового?" on the right, red
 * dot when there are unread notes. Click opens the modal.
 * ─────────────────────────────────────────────────────────────────── */

interface PlaqueProps {
  collapsed: boolean;
}

export function WhatsNewPlaque({ collapsed }: PlaqueProps) {
  const { open } = useWhatsNew();
  const { token } = antdTheme.useToken();
  const unreadQ = useQuery({
    queryKey: ["whats-new-unread"],
    queryFn: getUnreadReleaseNotes,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const unread = unreadQ.data?.unread_count ?? 0;

  return (
    <div
      onClick={open}
      style={{
        margin: collapsed ? "0 8px 8px" : "0 12px 8px",
        padding: collapsed ? "8px 0" : "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        // Subtle "chip" look — reads as something clickable without
        // competing with the menu items above.
        background: "rgba(255,255,255,0.04)",
        border: `1px solid rgba(255,255,255,0.08)`,
        color: "#d9d9d9",
        fontSize: 13,
        transition: "background .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
    >
      <Badge dot={unread > 0} color={token.colorPrimary} offset={[-2, 2]}>
        <RocketOutlined style={{ fontSize: 16, color: "#d9d9d9" }} />
      </Badge>
      {!collapsed && (
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Что нового?
        </span>
      )}
      {!collapsed && unread > 0 && (
        <span style={{ fontSize: 11, opacity: 0.7 }}>{unread}</span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Modal: near-fullscreen, newest-first list with a date range filter
 * and per-article X button that disappears unless you hover the row.
 * ─────────────────────────────────────────────────────────────────── */

function WhatsNewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const { token } = antdTheme.useToken();

  const params = useMemo(() => {
    if (!range) return undefined;
    const [from, to] = range;
    return {
      date_from: from?.startOf("day").toISOString(),
      date_to: to?.endOf("day").toISOString(),
    };
  }, [range]);

  const listQ = useQuery({
    queryKey: ["whats-new-list", params ?? "all"],
    queryFn: () => listReleaseNotes(params as any),
    enabled: open,
  });

  const dismissM = useMutation({
    mutationFn: dismissReleaseNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whats-new-unread"] });
      qc.invalidateQueries({ queryKey: ["whats-new-list"] });
    },
  });
  const dismissAllM = useMutation({
    mutationFn: dismissAllReleaseNotes,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whats-new-unread"] });
      qc.invalidateQueries({ queryKey: ["whats-new-list"] });
    },
  });

  // "Latest" = the first non-deprecated entry in the list (the list
  // comes back sorted by released_at DESC from the API). Deprecated
  // flag doesn't exist for release notes today — we treat the newest
  // published note as latest regardless of dismissed state.
  const notes = listQ.data ?? [];
  const latestId = notes.length > 0 ? notes[0].id : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1000px, 95vw)"
      style={{ top: 20 }}
      styles={{ body: { padding: 0 } }}
      title={
        <Space size={12}>
          <RocketOutlined style={{ color: token.colorPrimary }} />
          <span>Что нового</span>
        </Space>
      }
    >
      {/* Theme-aware markdown body styles for cards that come with body_md
          (ReleaseNoteFull). Scoped to .rn-body so they don't leak. */}
      <style>{`
        .rn-body { line-height: 1.6; font-size: 13.5px; color: ${token.colorText}; }
        .rn-body h1, .rn-body h2, .rn-body h3 {
          font-weight: 600; letter-spacing: -0.2px; margin: 16px 0 6px;
          color: ${token.colorText};
        }
        .rn-body h1 { font-size: 18px; }
        .rn-body h2 { font-size: 16px; }
        .rn-body h3 { font-size: 14px; }
        .rn-body p { margin: 8px 0; color: ${token.colorText}; }
        .rn-body ul, .rn-body ol { padding-left: 22px; }
        .rn-body li { margin: 3px 0; color: ${token.colorText}; }
        .rn-body code {
          background: ${token.colorFillTertiary};
          color: ${token.colorText};
          padding: 1px 5px; border-radius: 4px; font-size: 12px;
        }
        .rn-body pre {
          background: ${token.colorFillQuaternary};
          color: ${token.colorText};
          padding: 10px 12px; border-radius: 6px; overflow-x: auto;
        }
        .rn-body a { color: ${token.colorLink}; }
        .rn-body blockquote {
          border-left: 3px solid ${token.colorPrimary};
          color: ${token.colorTextSecondary};
          margin: 10px 0; padding: 2px 12px;
        }
        .rn-body strong { color: ${token.colorText}; }
      `}</style>

      <div style={{ padding: "12px 24px 16px", maxHeight: "86vh", overflowY: "auto" }}>
        <Space
          style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
          wrap
        >
          <Space>
            <FilterOutlined style={{ color: token.colorTextTertiary }} />
            <DatePicker.RangePicker
              value={range as any}
              onChange={(v) => setRange(v as any)}
              placeholder={["с", "по"]}
              allowClear
              format="DD.MM.YYYY"
            />
          </Space>
          <Button
            size="small"
            onClick={() => dismissAllM.mutate()}
            loading={dismissAllM.isPending}
            disabled={notes.every((n) => n.dismissed)}
          >
            Отметить всё прочитанным
          </Button>
        </Space>

        {listQ.isLoading ? null : notes.length === 0 ? (
          <Empty description="Ничего не найдено" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isLatest={note.id === latestId}
                onDismiss={() => dismissM.mutate(note.id)}
                dismissing={dismissM.isPending && dismissM.variables === note.id}
                onNavigate={onClose}
              />
            ))}
            <Alert
              type="info"
              showIcon={false}
              style={{ marginTop: 12, fontSize: 12 }}
              message="Отметки о прочтении хранятся на сервере и следуют за вами между устройствами."
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function NoteCard({
  note,
  isLatest,
  onDismiss,
  dismissing,
  onNavigate,
}: {
  note: ReleaseNoteSummary & { body_md?: string };
  isLatest: boolean;
  onDismiss: () => void;
  dismissing: boolean;
  onNavigate: () => void;
}) {
  const { token } = antdTheme.useToken();
  const [hover, setHover] = useState(false);
  // Green for the newest release, red (faded) for older releases that
  // have been superseded. "default" would read as "neutral" which is
  // not quite right here — the user asked for red on outdated.
  const tagColor = isLatest ? "green" : "red";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        padding: "18px 20px",
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        marginBottom: 12,
        background: note.dismissed ? token.colorFillQuaternary : token.colorBgContainer,
        opacity: note.dismissed ? 0.75 : 1,
        transition: "background .15s, opacity .15s",
      }}
    >
      {/* Close X — appears on hover, top-right. Per spec: clicking it
          dismisses the note for the current user, persistently. */}
      {hover && !note.dismissed && (
        <Tooltip title="Отметить прочитанным">
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined />}
            loading={dismissing}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{ position: "absolute", top: 10, right: 10 }}
          />
        </Tooltip>
      )}
      <Space align="center" style={{ marginBottom: 6 }}>
        <Tag color={tagColor}>v{note.version}</Tag>
        {isLatest && (
          <Tag color="green" style={{ fontSize: 10 }}>актуальная</Tag>
        )}
        {!isLatest && (
          <Tag color="red" style={{ fontSize: 10 }}>устарела</Tag>
        )}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(note.released_at).toLocaleDateString("ru-RU", {
            day: "2-digit", month: "long", year: "numeric",
          })}
        </Typography.Text>
        {!note.dismissed && (
          <Tag color="processing" style={{ fontSize: 10 }}>новое</Tag>
        )}
      </Space>
      {/* Clicking the title takes you to the permalink page. */}
      <Link
        to={`/whatsnew/${encodeURIComponent(note.version)}`}
        onClick={onNavigate}
        style={{ display: "block", color: "inherit" }}
      >
        <Typography.Title
          level={4}
          style={{ margin: "2px 0 6px", fontSize: 18 }}
        >
          {note.title}
        </Typography.Title>
      </Link>
      {note.excerpt && (
        <Typography.Paragraph style={{ margin: 0, color: token.colorTextSecondary }}>
          {note.excerpt}
        </Typography.Paragraph>
      )}
      {/* If the card already carries the full body (ie. we loaded a
          ReleaseNoteFull), render the markdown inline. The list endpoint
          only returns summaries so this is usually absent. */}
      {note.body_md && (
        <div style={{ marginTop: 10 }} className="rn-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body_md}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
