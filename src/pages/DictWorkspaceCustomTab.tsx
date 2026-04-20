/**
 * Custom (per-workspace) dictionaries — rendered as a tab inside the
 * unified Dictionaries page. Reuses the WorkspaceDictionaries page
 * component which already has the two-pane layout.
 */
import { Alert } from "antd";
import { useWorkspaceStore } from "@/store/workspace";
import { WorkspaceDictionaries } from "@/pages/WorkspaceDictionaries";

export function DictWorkspaceCustomTab() {
  const ws = useWorkspaceStore((s) => s.current);
  if (!ws) {
    return <Alert type="info" message="Выберите рабочее пространство в переключателе сверху" showIcon />;
  }
  return <WorkspaceDictionaries />;
}
