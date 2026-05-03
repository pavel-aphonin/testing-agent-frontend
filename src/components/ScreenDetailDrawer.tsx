import { Drawer, Empty, Typography } from "antd";

/**
 * Stub Drawer opened on graph-node click (PER-42).
 *
 * Shell only — the actual elements_json table + screenshot is added
 * by PER-38. This component already lives in the tree so that other
 * graph features (replay path, start-from-screen) can light up the
 * drawer without waiting for the data layer to land.
 *
 * When PER-38 is implemented:
 * - Replace the Empty placeholder with a fetched ScreenDetail body.
 * - Wire react-query for `useScreenElements(runId, screenHash)`.
 */

interface Props {
  open: boolean;
  runId: string | undefined;
  screenHash: string | null;
  onClose: () => void;
}

export function ScreenDetailDrawer({ open, runId, screenHash, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={screenHash ? `Экран ${screenHash.slice(0, 12)}…` : "Экран"}
      width={520}
      destroyOnHidden
    >
      {!screenHash || !runId ? (
        <Empty description="Экран не выбран" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Empty
          description={
            <Typography.Text type="secondary">
              Подробности экрана появятся в задаче PER-38: скриншот + таблица
              элементов (label / value / type / test_id) с поиском.
            </Typography.Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Drawer>
  );
}
