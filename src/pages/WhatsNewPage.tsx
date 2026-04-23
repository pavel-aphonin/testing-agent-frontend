import { ArrowLeftOutlined, RocketOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Space, Spin, Tag, theme as antdTheme, Typography } from "antd";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { dismissReleaseNote, getReleaseNote } from "@/api/releaseNotes";

/**
 * Permalink page for a single release. Shareable (``/whatsnew/0.4.0``),
 * SEO-friendlier than a modal, and a clean surface for long-form
 * release blurbs. Clicking the title in the modal brings you here.
 */
export function WhatsNewPage() {
  const { version } = useParams<{ version: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { token } = antdTheme.useToken();

  const q = useQuery({
    queryKey: ["release-note", version],
    queryFn: () => getReleaseNote(version!),
    enabled: !!version,
  });

  const dismissM = useMutation({
    mutationFn: () => dismissReleaseNote(q.data!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whats-new-unread"] });
      qc.invalidateQueries({ queryKey: ["whats-new-list"] });
      qc.invalidateQueries({ queryKey: ["release-note", version] });
    },
  });

  if (q.isLoading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }
  if (q.isError || !q.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Заметка не найдена"
        description="Возможно, версия была удалена или ещё не опубликована."
        action={<Button onClick={() => nav(-1)}>Назад</Button>}
      />
    );
  }

  const note = q.data;
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => nav(-1)}
        style={{ marginBottom: 16, padding: "4px 8px" }}
      >
        Назад
      </Button>

      <Space align="center" style={{ marginBottom: 8 }}>
        <RocketOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
        <Tag color="red">v{note.version}</Tag>
        <Typography.Text type="secondary">
          {new Date(note.released_at).toLocaleDateString("ru-RU", {
            day: "2-digit", month: "long", year: "numeric",
          })}
        </Typography.Text>
        {!note.dismissed && (
          <Button
            size="small"
            loading={dismissM.isPending}
            onClick={() => dismissM.mutate()}
          >
            Отметить прочитанным
          </Button>
        )}
      </Space>

      <Typography.Title level={2} style={{ marginTop: 4, marginBottom: 16, letterSpacing: "-0.4px" }}>
        {note.title}
      </Typography.Title>

      <style>{`
        .rn-body { line-height: 1.7; font-size: 14.5px; }
        .rn-body h1, .rn-body h2, .rn-body h3 {
          font-weight: 600; letter-spacing: -0.2px; margin: 24px 0 8px;
        }
        .rn-body h1 { font-size: 22px; }
        .rn-body h2 { font-size: 18px; }
        .rn-body h3 { font-size: 15px; }
        .rn-body p { margin: 10px 0; }
        .rn-body ul, .rn-body ol { padding-left: 24px; }
        .rn-body li { margin: 4px 0; }
        .rn-body code { background: var(--ta-code-bg, #f5f5f5); padding: 1px 5px;
          border-radius: 4px; font-size: 12.5px; }
      `}</style>
      <div className="rn-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body_md}</ReactMarkdown>
      </div>
    </div>
  );
}
