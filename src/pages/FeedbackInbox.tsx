import { LinkOutlined, MessageOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Segmented,
  Space,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

import {
  listFeedbackInbox,
  updateFeedbackTicket,
} from "@/api/help";
import type { FeedbackKind, FeedbackStatus, FeedbackTicketRead } from "@/types";
import { notify } from "@/utils/notify";

const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Баг",
  question: "Вопрос",
  proposal: "Предложение",
  other: "Другое",
};
const KIND_COLOR: Record<FeedbackKind, string> = {
  bug: "red",
  question: "blue",
  proposal: "purple",
  other: "default",
};
const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Новое",
  in_progress: "В работе",
  closed: "Закрыто",
};
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  new: "gold",
  in_progress: "blue",
  closed: "default",
};

export function FeedbackInbox() {
  const [filter, setFilter] = useState<FeedbackStatus | "all">("new");
  const [selected, setSelected] = useState<FeedbackTicketRead | null>(null);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["feedback-inbox", filter],
    queryFn: () => listFeedbackInbox(filter === "all" ? undefined : filter),
  });

  return (
    <>
      <Space
        style={{ justifyContent: "space-between", width: "100%", marginBottom: 16 }}
        wrap
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            <MessageOutlined style={{ color: "#EE3424", marginRight: 8 }} />
            Обращения пользователей
          </Typography.Title>
          <Typography.Text type="secondary">
            Заявки со справочной страницы. Синхронизацию в Jira включит будущее приложение из магазина.
          </Typography.Text>
        </div>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as FeedbackStatus | "all")}
          options={[
            { value: "new", label: "Новые" },
            { value: "in_progress", label: "В работе" },
            { value: "closed", label: "Закрытые" },
            { value: "all", label: "Все" },
          ]}
        />
      </Space>

      {q.isLoading ? null : (q.data?.length ?? 0) === 0 ? (
        <Empty description="Пусто — все обращения обработаны или их пока никто не прислал" />
      ) : (
        <div>
          {(q.data ?? []).map((t) => (
            <Card
              key={t.id}
              size="small"
              hoverable
              style={{ marginBottom: 8 }}
              onClick={() => setSelected(t)}
            >
              <Space
                style={{ width: "100%", justifyContent: "space-between" }}
                align="start"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Space style={{ marginBottom: 4 }} wrap>
                    <Tag color={KIND_COLOR[t.kind]}>{KIND_LABEL[t.kind]}</Tag>
                    <Tag color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Tag>
                    {t.external_id && (
                      <Tag icon={<LinkOutlined />} color="geekblue">
                        {t.external_id}
                      </Tag>
                    )}
                  </Space>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{t.subject}</div>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 12, margin: 0 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {t.body}
                  </Typography.Paragraph>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#8c8c8c" }}>
                  <div>{t.user_email ?? "аноним"}</div>
                  <div>
                    {new Date(t.created_at).toLocaleDateString("ru-RU")}{" "}
                    {new Date(t.created_at).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </Space>
            </Card>
          ))}
        </div>
      )}

      <FeedbackDetails
        ticket={selected}
        onClose={() => setSelected(null)}
        onUpdated={() => {
          qc.invalidateQueries({ queryKey: ["feedback-inbox"] });
        }}
      />
    </>
  );
}

function FeedbackDetails({
  ticket,
  onClose,
  onUpdated,
}: {
  ticket: FeedbackTicketRead | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form] = Form.useForm();
  const m = useMutation({
    mutationFn: (patch: {
      status?: FeedbackStatus;
      admin_notes?: string;
      external_id?: string;
    }) =>
      ticket
        ? updateFeedbackTicket(ticket.id, patch)
        : Promise.reject(new Error("no ticket")),
    onSuccess: () => {
      notify.success("Сохранено");
      onUpdated();
      onClose();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  return (
    <Drawer
      title={ticket ? `Обращение: ${ticket.subject}` : ""}
      open={Boolean(ticket)}
      onClose={onClose}
      width={640}
      destroyOnHidden
    >
      {ticket && (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag color={KIND_COLOR[ticket.kind]}>{KIND_LABEL[ticket.kind]}</Tag>
            <Tag color={STATUS_COLOR[ticket.status]}>{STATUS_LABEL[ticket.status]}</Tag>
          </Space>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {ticket.user_email ?? "аноним"} ·{" "}
              {new Date(ticket.created_at).toLocaleString("ru-RU")}
            </Typography.Text>
          </div>

          <Alert
            type="info"
            showIcon={false}
            banner
            message={
              <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {ticket.body}
              </Typography.Paragraph>
            }
            style={{ marginBottom: 20 }}
          />

          {ticket.context && Object.keys(ticket.context).length > 0 && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#595959" }}>
                Технический контекст
              </summary>
              <pre style={{
                fontSize: 11, background: "#fafafa", padding: 10,
                borderRadius: 6, marginTop: 6,
              }}>
                {JSON.stringify(ticket.context, null, 2)}
              </pre>
            </details>
          )}

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: ticket.status,
              external_id: ticket.external_id ?? "",
              admin_notes: ticket.admin_notes ?? "",
            }}
            onFinish={(v) => m.mutate(v)}
          >
            <Form.Item name="status" label="Статус">
              <Segmented
                options={[
                  { value: "new", label: "Новое" },
                  { value: "in_progress", label: "В работе" },
                  { value: "closed", label: "Закрыто" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="external_id"
              label="ID в Jira"
              extra="Если уже завели задачу вручную — сохраните сюда номер."
            >
              <Input placeholder="MKOV-123" />
            </Form.Item>
            <Form.Item name="admin_notes" label="Заметки администратора">
              <Input.TextArea
                rows={4}
                placeholder="Видно только админам. Куда передано, что решили и т. п."
              />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={m.isPending}>
                Сохранить
              </Button>
              <Button onClick={onClose}>Отмена</Button>
            </Space>
          </Form>
        </>
      )}
    </Drawer>
  );
}
