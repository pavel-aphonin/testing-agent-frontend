import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  SettingOutlined,
  TagsOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Tabs, Tooltip, Typography } from "antd";
import { useSearchParams } from "react-router-dom";

import { DictAttributesTab } from "@/pages/DictAttributesTab";
import { DictNotificationTypesTab } from "@/pages/DictNotificationTypesTab";
import { DictRolesTab } from "@/pages/DictRolesTab";
import { DictWorkspaceCustomTab } from "@/pages/DictWorkspaceCustomTab";
import { DictWorkspacesTab } from "@/pages/DictWorkspacesTab";
import { useWorkspaceStore } from "@/store/workspace";

/**
 * Single Справочники page with all dictionaries as tabs.
 *
 * Each tab gets an icon to indicate its origin:
 *   ⚙ (SettingOutlined) — system dictionary, admin-managed
 *   🔖 (BookOutlined)   — workspace-scoped, user-created
 *
 * Active tab persists in the URL query string (?tab=roles).
 */
export function Dictionaries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ws = useWorkspaceStore((s) => s.current);
  const activeTab = searchParams.get("tab") ?? "roles";

  const sysIcon = (
    <Tooltip title="Системный справочник">
      <SettingOutlined style={{ color: "#888" }} />
    </Tooltip>
  );
  const userIcon = (
    <Tooltip title="Пользовательский справочник пространства">
      <BookOutlined style={{ color: "#EE3424" }} />
    </Tooltip>
  );

  return (
    <>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        Справочники
      </Typography.Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={[
          {
            key: "roles",
            label: (
              <span>
                {sysIcon} <TeamOutlined /> Роли
              </span>
            ),
            children: <DictRolesTab />,
          },
          {
            key: "workspaces",
            label: (
              <span>
                {sysIcon} <AppstoreOutlined /> Рабочие пространства
              </span>
            ),
            children: <DictWorkspacesTab />,
          },
          {
            key: "attributes",
            label: (
              <span>
                {sysIcon} <TagsOutlined /> Атрибуты
              </span>
            ),
            children: <DictAttributesTab />,
          },
          {
            key: "notification-types",
            label: (
              <span>
                {sysIcon} <BellOutlined /> Типы уведомлений
              </span>
            ),
            children: <DictNotificationTypesTab />,
          },
          {
            key: "custom",
            label: (
              <span>
                {userIcon} <BookOutlined />{" "}
                {ws ? `Справочники «${ws.name}»` : "Справочники пространства"}
              </span>
            ),
            children: <DictWorkspaceCustomTab />,
          },
        ]}
      />
    </>
  );
}
