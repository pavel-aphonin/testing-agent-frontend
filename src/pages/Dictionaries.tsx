import {
  ApartmentOutlined,
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  MobileOutlined,
  TagsOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Segmented, Tabs, Typography } from "antd";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { RefDictTab } from "@/components/RefDictTab";
import { DictAttributesTab } from "@/pages/DictAttributesTab";
import { DictNotificationTypesTab } from "@/pages/DictNotificationTypesTab";
import { DictRolesTab } from "@/pages/DictRolesTab";
import { DictWorkspaceCustomTab } from "@/pages/DictWorkspaceCustomTab";
import { DictWorkspacesTab } from "@/pages/DictWorkspacesTab";
import { useWorkspaceStore } from "@/store/workspace";

type TabKind = "system" | "user" | "all";

interface TabDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  origin: "system" | "user";
  content: React.ReactNode;
}

export function Dictionaries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ws = useWorkspaceStore((s) => s.current);
  const activeTab = searchParams.get("tab") ?? "roles";
  const [origin, setOrigin] = useState<TabKind>("all");

  const allTabs: TabDef[] = useMemo(() => [
    {
      key: "roles",
      label: "Роли",
      icon: <TeamOutlined />,
      origin: "system",
      content: <DictRolesTab />,
    },
    {
      key: "workspaces",
      label: "Рабочие пространства",
      icon: <AppstoreOutlined />,
      origin: "system",
      content: <DictWorkspacesTab />,
    },
    {
      key: "attributes",
      label: "Атрибуты",
      icon: <TagsOutlined />,
      origin: "system",
      content: <DictAttributesTab />,
    },
    {
      key: "notification-types",
      label: "Типы уведомлений",
      icon: <BellOutlined />,
      origin: "system",
      content: <DictNotificationTypesTab />,
    },
    {
      key: "platforms",
      label: "Платформы",
      icon: <ClusterOutlined />,
      origin: "system",
      content: (
        <RefDictTab
          kind="platforms"
          tableKey="ref.platforms"
          createLabel="Создать платформу"
          fields={[{ name: "sort_order", label: "Порядок", type: "number" }]}
        />
      ),
    },
    {
      key: "os-versions",
      label: "Версии ОС",
      icon: <ApartmentOutlined />,
      origin: "system",
      content: (
        <RefDictTab
          kind="os-versions"
          tableKey="ref.os-versions"
          createLabel="Создать версию ОС"
          fields={[
            {
              name: "platform_code",
              label: "Платформа",
              type: "select",
              required: true,
              options: [
                { value: "ios", label: "iOS" },
                { value: "android", label: "Android" },
                { value: "desktop", label: "Desktop" },
                { value: "web", label: "Web" },
              ],
            },
          ]}
          extraColumns={[
            {
              key: "platform_code",
              title: "Платформа",
              dataIndex: "platform_code",
              width: 120,
              filters: [
                { text: "iOS", value: "ios" },
                { text: "Android", value: "android" },
                { text: "Desktop", value: "desktop" },
                { text: "Web", value: "web" },
              ],
              onFilter: (v, r) => r.platform_code === v,
            },
          ]}
        />
      ),
    },
    {
      key: "device-types",
      label: "Типы устройств",
      icon: <MobileOutlined />,
      origin: "system",
      content: (
        <RefDictTab
          kind="device-types"
          tableKey="ref.device-types"
          createLabel="Создать устройство"
          fields={[
            {
              name: "platform_code",
              label: "Платформа",
              type: "select",
              required: true,
              options: [
                { value: "ios", label: "iOS" },
                { value: "android", label: "Android" },
                { value: "desktop", label: "Desktop" },
                { value: "web", label: "Web" },
              ],
            },
          ]}
          extraColumns={[
            {
              key: "platform_code",
              title: "Платформа",
              dataIndex: "platform_code",
              width: 120,
              filters: [
                { text: "iOS", value: "ios" },
                { text: "Android", value: "android" },
                { text: "Desktop", value: "desktop" },
                { text: "Web", value: "web" },
              ],
              onFilter: (v, r) => r.platform_code === v,
            },
          ]}
        />
      ),
    },
    {
      key: "action-types",
      label: "Типы действий",
      icon: <ThunderboltOutlined />,
      origin: "system",
      content: (
        <RefDictTab
          kind="action-types"
          tableKey="ref.action-types"
          createLabel="Создать действие"
          fields={[
            { name: "description", label: "Описание" },
            {
              name: "platform_scope",
              label: "Где доступно",
              type: "select",
              required: true,
              defaultValue: "universal",
              options: [
                { value: "universal", label: "Везде" },
                { value: "ios", label: "Только iOS" },
                { value: "android", label: "Только Android" },
                { value: "desktop", label: "Только Desktop" },
                { value: "web", label: "Только Web" },
              ],
            },
          ]}
          extraColumns={[
            {
              key: "platform_scope",
              title: "Где",
              dataIndex: "platform_scope",
              width: 130,
              filters: [
                { text: "Везде", value: "universal" },
                { text: "iOS", value: "ios" },
                { text: "Android", value: "android" },
                { text: "Desktop", value: "desktop" },
                { text: "Web", value: "web" },
              ],
              onFilter: (v, r) => r.platform_scope === v,
            },
          ]}
        />
      ),
    },
    {
      key: "test-data-types",
      label: "Типы тестовых данных",
      icon: <DatabaseOutlined />,
      origin: "system",
      content: (
        <RefDictTab
          kind="test-data-types"
          tableKey="ref.test-data-types"
          createLabel="Создать тип"
          fields={[]}
        />
      ),
    },
    {
      key: "custom",
      label: ws ? `Справочники «${ws.name}»` : "Справочники пространства",
      icon: <BookOutlined />,
      origin: "user",
      content: <DictWorkspaceCustomTab />,
    },
  ], [ws]);

  const visibleTabs = useMemo(
    () => (origin === "all" ? allTabs : allTabs.filter((t) => t.origin === origin)),
    [origin, allTabs],
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Справочники</Typography.Title>
        <Segmented
          value={origin}
          onChange={(v) => setOrigin(v as TabKind)}
          options={[
            { label: "Все", value: "all" },
            { label: "Системные", value: "system" },
            { label: "Пользовательские", value: "user" },
          ]}
        />
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={visibleTabs.map((t) => ({
          key: t.key,
          label: <span>{t.icon} {t.label}</span>,
          children: t.content,
        }))}
      />
    </>
  );
}
