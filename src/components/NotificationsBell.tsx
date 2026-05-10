import { BellOutlined, CheckOutlined, MailOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Dropdown, Empty, List, Space, Tag, Typography, theme } from "antd";

import {
  acceptInvitation,
  declineInvitation,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "@/api/notifications";
import { useAuthStore } from "@/store/auth";
import type { NotificationRead } from "@/types";
import { notify } from "@/utils/notify";

/** Bell icon in the top-right with unread badge + dropdown of recent notifications. */
export function NotificationsBell() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { token: themeToken } = theme.useToken();

  const countQ = useQuery({
    queryKey: ["notif-unread-count"],
    queryFn: unreadCount,
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });

  const listQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(false),
    enabled: Boolean(token),
    staleTime: 10_000,
  });

  const markReadM = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    },
  });

  const markAllM = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    },
  });

  const acceptM = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      notify.success("Приглашение принято");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const declineM = useMutation({
    mutationFn: declineInvitation,
    onSuccess: () => {
      notify.info("Приглашение отклонено");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const count = countQ.data?.count ?? 0;
  const items = listQ.data ?? [];

  const dropdownContent = (
    <div
      style={{
        background: themeToken.colorBgElevated,
        boxShadow: themeToken.boxShadowSecondary,
        borderRadius: 8,
        width: 380,
        maxHeight: 480,
        overflow: "auto",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography.Text strong>Уведомления</Typography.Text>
        {count > 0 && (
          <Button size="small" type="link" onClick={() => markAllM.mutate()}>
            Прочитать всё
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пусто" style={{ padding: 24 }} />
      ) : (
        <List
          size="small"
          dataSource={items}
          renderItem={(n) => (
            <NotificationItem
              n={n}
              onMarkRead={() => markReadM.mutate(n.id)}
              onAccept={() => {
                const invId = (n.payload as { invitation_id?: string })?.invitation_id;
                if (invId) acceptM.mutate(invId);
              }}
              onDecline={() => {
                const invId = (n.payload as { invitation_id?: string })?.invitation_id;
                if (invId) declineM.mutate(invId);
              }}
              accepting={acceptM.isPending}
              declining={declineM.isPending}
            />
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
    >
      <Badge count={count} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 16, color: count > 0 ? "#EE3424" : themeToken.colorTextTertiary }} />}
          style={{ display: "flex", alignItems: "center" }}
        />
      </Badge>
    </Dropdown>
  );
}

function NotificationItem({
  n,
  onMarkRead,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  n: NotificationRead;
  onMarkRead: () => void;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
}) {
  const isInvite = n.type === "workspace_invite";
  const { token: themeToken } = theme.useToken();
  return (
    <List.Item
      style={{
        padding: "10px 16px",
        background: n.is_read ? themeToken.colorBgElevated : themeToken.colorErrorBg,
        cursor: "pointer",
      }}
      onClick={() => !n.is_read && onMarkRead()}
    >
      <div style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            {isInvite ? <MailOutlined /> : <BellOutlined />}
            <Typography.Text strong>{n.title}</Typography.Text>
          </Space>
          {!n.is_read && <Tag color="red">Новое</Tag>}
        </Space>
        {n.body && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
            {n.body}
          </Typography.Paragraph>
        )}
        {isInvite && (
          <Space style={{ marginTop: 8 }} size="small">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={accepting}
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
            >
              Принять
            </Button>
            <Button
              size="small"
              loading={declining}
              onClick={(e) => {
                e.stopPropagation();
                onDecline();
              }}
            >
              Отклонить
            </Button>
          </Space>
        )}
      </div>
    </List.Item>
  );
}
