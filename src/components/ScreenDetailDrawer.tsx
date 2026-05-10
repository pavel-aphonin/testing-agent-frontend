import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Drawer,
  Empty,
  Image,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";
import { useMemo, useState } from "react";

import { getScreenElements, type ScreenElement } from "@/api/runs";

/**
 * Screen-level details panel opened from a graph node click (PER-38).
 *
 * Shell was scaffolded by PER-42; this fills the body in:
 * - Lazy-loads ``elements_json`` via /api/runs/{id}/screens/{hash}/elements
 *   (cached forever — screen contents are immutable post-run).
 * - Renders the screenshot at the top.
 * - Below: searchable + filterable table of every UI element the agent
 *   saw on this screen (label / value / type / test_id).
 *
 * Filters intentionally live in component state (not URL) — drawer is
 * transient, no need to deep-link a search query.
 */

interface Props {
  open: boolean;
  runId: string | undefined;
  screenHash: string | null;
  onClose: () => void;
}

export function ScreenDetailDrawer({ open, runId, screenHash, onClose }: Props) {
  const enabled = open && Boolean(runId) && Boolean(screenHash);
  const elementsQ = useQuery({
    queryKey: ["screen-elements", runId, screenHash],
    queryFn: () => getScreenElements(runId!, screenHash!),
    enabled,
    staleTime: Infinity,  // immutable post-run
  });

  const title = elementsQ.data?.name
    ?? (screenHash ? `Экран ${screenHash.slice(0, 12)}…` : "Экран");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      width={640}
      destroyOnHidden
    >
      {!screenHash || !runId ? (
        <Empty description="Экран не выбран" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : elementsQ.isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin />
        </div>
      ) : elementsQ.isError ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить детали экрана"
          description={String((elementsQ.error as Error)?.message ?? "")}
        />
      ) : (
        <ScreenBody
          runId={runId}
          screenHash={screenHash}
          screenshotPath={elementsQ.data?.screenshot_path ?? null}
          elements={elementsQ.data?.elements ?? []}
        />
      )}
    </Drawer>
  );
}

function ScreenBody({
  runId, screenHash, screenshotPath, elements,
}: {
  runId: string;
  screenHash: string;
  screenshotPath: string | null;
  elements: ScreenElement[];
}) {
  const { token } = theme.useToken();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  // Sorted unique element types for the filter dropdown — gives the
  // user a sense of what's actually on the screen instead of guessing.
  const types = useMemo(() => {
    const t = new Set<string>();
    for (const el of elements) if (el.type) t.add(String(el.type));
    return Array.from(t).sort();
  }, [elements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return elements.filter((el) => {
      if (typeFilter && el.type !== typeFilter) return false;
      if (q) {
        const haystack = [
          el.label, el.value, el.test_id, el.identifier, el.type,
        ].filter((x) => x != null).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [elements, search, typeFilter]);

  const screenshotSrc = screenshotPath
    ? `/api/runs/${runId}/screens/${screenHash}/screenshot`
    : null;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {screenshotSrc ? (
        <Image
          src={screenshotSrc}
          alt={screenHash}
          width="100%"
          style={{ maxHeight: 360, objectFit: "contain", background: token.colorFillQuaternary, borderRadius: 4 }}
          preview
        />
      ) : (
        <div
          style={{
            height: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: token.colorFillQuaternary, borderRadius: 4,
            color: token.colorTextDisabled, fontSize: 13,
          }}
        >
          Скриншот не сохранён
        </div>
      )}

      <Space style={{ width: "100%" }} wrap>
        <Input.Search
          placeholder="Поиск по label / value / test_id"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="Все типы"
          style={{ width: 200 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={types.map((t) => ({ value: t, label: t }))}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {filtered.length} из {elements.length}
        </Typography.Text>
      </Space>

      <Table
        size="small"
        rowKey={(r, i) => `${r.test_id ?? r.identifier ?? r.label ?? "_"}-${i}`}
        dataSource={filtered}
        pagination={filtered.length > 50 ? { pageSize: 50 } : false}
        columns={[
          {
            title: "Тип",
            dataIndex: "type",
            width: 130,
            render: (v) => <Tag>{String(v ?? "—")}</Tag>,
          },
          {
            title: "Label",
            dataIndex: "label",
            ellipsis: true,
            render: (v) => v ? <Typography.Text>{String(v)}</Typography.Text>
                              : <Typography.Text type="secondary">—</Typography.Text>,
          },
          {
            title: "Value",
            dataIndex: "value",
            ellipsis: true,
            render: (v) => v
              ? <Typography.Text code>{String(v)}</Typography.Text>
              : <Typography.Text type="secondary">—</Typography.Text>,
          },
          {
            title: "test_id",
            width: 180,
            render: (_, r) => {
              const id = r.test_id ?? r.identifier;
              return id
                ? <Typography.Text code style={{ fontSize: 11 }}>{String(id)}</Typography.Text>
                : <Typography.Text type="secondary">—</Typography.Text>;
            },
          },
        ]}
      />
    </Space>
  );
}
