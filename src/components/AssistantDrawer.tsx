import { CloseOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Avatar, Button, Drawer, Input, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  chatWithAssistant,
  type AssistantContext,
  type AssistantMessage,
} from "@/api/assistant";
import { notify } from "@/utils/notify";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Right-side drawer with the AI helper. Sniffs the current route to
 * figure out what the user is looking at and posts that context with
 * each message — the assistant then has actual data (run summary,
 * defects, scenario steps) to reason about, not just generic hints.
 *
 * Suggestions adapt to context: on a run page we offer "summarise
 * defects", on the home / runs list we offer "what should I test
 * next" type prompts.
 */
export function AssistantDrawer({ open, onClose }: Props) {
  const location = useLocation();
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset chat when drawer closes — fresh start each session.
  useEffect(() => {
    if (!open) {
      setHistory([]);
      setDraft("");
    }
  }, [open]);

  // Detect context from current URL. Cheap heuristics — backend loads the
  // actual data, we just point at the right object.
  const ctx: AssistantContext = useMemo(() => {
    const route = location.pathname;
    const result: AssistantContext = { route };
    // /runs/:id/{progress,results} → run_id
    const runMatch = route.match(/\/runs\/([0-9a-f-]{36})/i);
    if (runMatch) result.run_id = runMatch[1];
    // /scenarios/:id (or /scenarios with selected id from page state — not in URL)
    const scenarioMatch = route.match(/\/scenarios\/([0-9a-f-]{36})/i);
    if (scenarioMatch) result.scenario_id = scenarioMatch[1];
    return result;
  }, [location.pathname]);

  // Suggestions tuned to context. We refresh on each drawer open so the
  // user sees relevant prompts for whatever page they're on.
  const suggestions = useMemo(() => contextualSuggestions(ctx), [ctx]);

  const send = useMutation({
    mutationFn: (text: string) => {
      const next: AssistantMessage[] = [
        ...history,
        { role: "user", content: text },
      ];
      setHistory(next);
      return chatWithAssistant(next, ctx);
    },
    onSuccess: (resp) => {
      setHistory((prev) => [...prev, { role: "assistant", content: resp.answer }]);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не удалось получить ответ";
      notify.error("Ассистент недоступен", detail);
      setHistory((prev) => prev.slice(0, -1));
    },
  });

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

  const contextLabel = describeContext(ctx);

  return (
    <Drawer
      title={
        <Space>
          <Avatar style={{ background: "#EE3424" }}>М</Avatar>
          <span>Помощник</span>
          {contextLabel && (
            <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
              {contextLabel}
            </Tag>
          )}
        </Space>
      }
      placement="right"
      width={460}
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
            placeholder="Что нужно сделать?"
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
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
              {contextLabel
                ? `Я вижу: ${contextLabel}. Чем помочь?`
                : "Опишите, с чем нужна помощь. Несколько идей:"}
            </Typography.Paragraph>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {suggestions.map((q) => (
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
            <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 11 }}>
              Если вам нужно описание системы и инструкции — откройте раздел «Справка» в боковом меню.
            </Typography.Paragraph>
          </div>
        ) : (
          history.map((msg, i) => <Message key={i} message={msg} />)
        )}
        {send.isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Avatar size="small" style={{ background: "#EE3424" }}>М</Avatar>
            <Spin size="small" /> <Typography.Text type="secondary">Думаю…</Typography.Text>
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

function describeContext(ctx: AssistantContext): string | null {
  if (ctx.run_id) return "запуск";
  if (ctx.scenario_id) return "сценарий";
  if (ctx.route?.startsWith("/knowledge")) return "база знаний";
  if (ctx.route?.startsWith("/test-data")) return "тестовые данные";
  if (ctx.route?.startsWith("/runs")) return "список запусков";
  return null;
}

function contextualSuggestions(ctx: AssistantContext): string[] {
  if (ctx.run_id) {
    return [
      "Кратко резюмируй результаты этого запуска",
      "Какие дефекты самые критичные? Расставь приоритет",
      "Какие из найденных багов могут быть false positive?",
      "Что стоит протестировать дополнительно?",
      "Сформируй описание для тикета по самому критичному багу",
    ];
  }
  if (ctx.scenario_id) {
    return [
      "Проверь сценарий на ошибки и пропуски",
      "Какие тестовые данные нужны для этого сценария?",
      "Предложи негативные шаги для проверки валидации",
    ];
  }
  if (ctx.route?.startsWith("/knowledge")) {
    return [
      "Подскажи, какие документы стоит загрузить для лучшего качества RAG",
      "Какой документ устарел и его стоит обновить?",
    ];
  }
  if (ctx.route?.startsWith("/runs")) {
    return [
      "Сравни последние запуски — где больше всего дефектов?",
      "Какой запуск был наиболее результативным?",
      "Что стоит запустить следующим?",
    ];
  }
  return [
    "С чего начать тестирование нового приложения?",
    "Какие шаги предпринять, если агент находит мало багов?",
    "Как лучше использовать сценарии и тестовые данные?",
  ];
}
