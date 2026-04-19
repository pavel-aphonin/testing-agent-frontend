import { Tabs, Typography } from "antd";
import { useSearchParams } from "react-router-dom";

import { DictAttributesTab } from "@/pages/DictAttributesTab";
import { DictRolesTab } from "@/pages/DictRolesTab";
import { DictWorkspacesTab } from "@/pages/DictWorkspacesTab";

/**
 * Справочники — tabbed page. Each dictionary is a tab.
 * Active tab persists in the URL query string (?tab=roles).
 *
 * Each dictionary supports unlimited-depth tree grouping (parent_id).
 */
export function Dictionaries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "roles";

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
            label: "Роли",
            children: <DictRolesTab />,
          },
          {
            key: "workspaces",
            label: "Рабочие пространства",
            children: <DictWorkspacesTab />,
          },
          {
            key: "attributes",
            label: "Атрибуты",
            children: <DictAttributesTab />,
          },
        ]}
      />
    </>
  );
}
