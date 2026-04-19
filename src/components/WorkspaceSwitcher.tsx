import { AppstoreOutlined, SwapOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Dropdown, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { useEffect } from "react";

import { myWorkspaces, workspaceLogoUrl } from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";

/**
 * Workspace switcher in the top-left of the header bar.
 *
 * Shows current workspace name + a dropdown of all workspaces the user
 * belongs to. Clicking one switches the context — all scoped queries
 * (runs, scenarios, etc.) will filter by this workspace_id.
 */
export function WorkspaceSwitcher() {
  const token = useAuthStore((s) => s.token);
  const current = useWorkspaceStore((s) => s.current);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);

  const { data: workspaces } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: myWorkspaces,
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (!current && workspaces && workspaces.length > 0) {
      setCurrent(workspaces[0]);
    }
  }, [current, workspaces, setCurrent]);

  // If current workspace was removed from the list, deselect
  useEffect(() => {
    if (current && workspaces && !workspaces.find((w) => w.id === current.id)) {
      setCurrent(workspaces.length > 0 ? workspaces[0] : null);
    }
  }, [current, workspaces, setCurrent]);

  const items: MenuProps["items"] = [
    ...(workspaces ?? []).map((ws) => {
      const logoUrl = workspaceLogoUrl(ws.id, ws.logo_path);
      return {
        key: ws.id,
        label: (
          <Space>
            {logoUrl ? (
              <Avatar size={20} src={logoUrl} shape="square" />
            ) : (
              <AppstoreOutlined />
            )}
            <span>{ws.name}</span>
            {ws.id === current?.id && <Tag color="green">текущее</Tag>}
          </Space>
        ),
        onClick: () => setCurrent(ws),
      };
    }),
  ];

  if (!workspaces || workspaces.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        <AppstoreOutlined /> Нет пространств
      </Typography.Text>
    );
  }

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomLeft">
      <Button
        type="text"
        size="small"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 600,
          fontSize: 13,
          color: "#333",
          maxWidth: 240,
        }}
      >
        {current && workspaceLogoUrl(current.id, current.logo_path) ? (
          <Avatar
            size={20}
            src={workspaceLogoUrl(current.id, current.logo_path)!}
            shape="square"
          />
        ) : (
          <AppstoreOutlined style={{ color: "#EE3424" }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.name ?? "Выберите пространство"}
        </span>
        <SwapOutlined style={{ fontSize: 10, color: "#999" }} />
      </Button>
    </Dropdown>
  );
}
