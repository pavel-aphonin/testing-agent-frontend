import { CloseOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Avatar, Button, Drawer, Input, Space, Spin, Typography } from "antd";
import { useEffect, useRef, useState } from "react";

import { chatWithAssistant, type AssistantMessage } from "@/api/assistant";
import { notify } from "@/utils/notify";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Как создать новый запуск?",
  "Что такое режим Hybrid?",
  "Как написать сценарий?",
  "Что значит P0 и P1?",
  "Как работают тестовые данные?",
];

/**
 * Right-side drawer with a chat to the in-app assistant. Triggered from
 * the header bubble. Conversation state lives here (not server-side) —
 * each turn posts the full thread to /api/assistant/chat.
 *
 * No streaming; the assistant should answer in 1-3 seconds, so a single
 * spinner is fine. If the LLM is slow the bubble will show "Печатает…"
 * while we wait.
 */
export function AssistantDrawer({ open, onClose }: Props) {
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (text: string) => {
      const next: AssistantMessage[] = [
        ...history,
        { role: "user", content: text },
      ];
      setHistory(next);
      return chatWithAssistant(next);
    },
    onSuccess: (resp) => {
      setHistory((prev) => [...prev, { role: "assistant", content: resp.answer }]);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не удалось получить ответ";
      notify.error("Ассистент недоступен", detail);
      // Roll back the optimistic user message so they can retry
      setHistory((prev) => prev.slice(0, -1));
    },
  });

  // Scroll to bottom when new messages arrive or while typing.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, send.isPending]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft("");
    send.mutate(text);
  };

  const handleSuggestion = (q: string) => {
    if (send.isPending) return;
    send.mutate(q);
  };

  return (
    <Drawer
      title={
        <Space>
          <Avatar style={{ background: "#EE3424" }}>М</Avatar>
          <span>Ассистент</span>
        </Space>
      }
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      closeIcon={<CloseOutlined />}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
      footer={
        <Space.Compact style={{ width: "100%" }}>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Спросите про систему…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={send.isPending}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={send.isPending}
            disabled={!draft.trim()}
          />
        </Space.Compact>
      }
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          background: "#fafafa",
        }}
      >
        {history.length === 0 ? (
          <div>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Спросите что-нибудь о Маркове. Несколько примеров:
            </Typography.Paragraph>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  size="small"
                  onClick={() => handleSuggestion(q)}
                  style={{ textAlign: "left", height: "auto", whiteSpace: "normal" }}
                  block
                >
                  {q}
                </Button>
              ))}
            </Space>
          </div>
        ) : (
          history.map((msg, i) => <Message key={i} message={msg} />)
        )}
        {send.isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Avatar size="small" style={{ background: "#EE3424" }}>М</Avatar>
            <Spin size="small" /> <Typography.Text type="secondary">Печатает…</Typography.Text>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Message({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <Avatar
        size="small"
        style={{ background: isUser ? "#1677ff" : "#EE3424", flexShrink: 0 }}
      >
        {isUser ? "Я" : "М"}
      </Avatar>
      <div
        style={{
          background: isUser ? "#e6f4ff" : "#fff",
          border: isUser ? "1px solid #91caff" : "1px solid #f0f0f0",
          borderRadius: 8,
          padding: "8px 12px",
          maxWidth: "85%",
          whiteSpace: "pre-wrap",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
