import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Card,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";

import { listAttributes, listAttributeValues, setAttributeValue } from "@/api/attributes";
import { listDictionaryItems } from "@/api/customDictionaries";
import { listAdminUsers } from "@/api/users";
import type { AttributeRead, AttributeValueRead } from "@/types";
import { buildTree } from "@/utils/tree";
import { notify } from "@/utils/notify";

interface Props {
  /** "workspace" or "user_workspace". */
  entityType: "workspace" | "user_workspace";
  /** UUID of the workspace (for entityType=workspace) or membership row. */
  entityId: string;
}

/**
 * Renders all attributes that apply to (entityType, entityId) and lets
 * the user set/clear their values inline. Saves on change (debounced
 * via the mutation; no submit button).
 *
 * Uses a tree layout — attributes nested under group folders.
 */
export function AttributeValuesEditor({ entityType, entityId }: Props) {
  const qc = useQueryClient();

  const attrsQ = useQuery({
    queryKey: ["attributes-for", entityType],
    queryFn: () => listAttributes(entityType),
  });

  const valsQ = useQuery({
    queryKey: ["attribute-values", entityType, entityId],
    queryFn: () => listAttributeValues(entityType, entityId),
    enabled: Boolean(entityId),
  });

  const setM = useMutation({
    mutationFn: setAttributeValue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attribute-values", entityType, entityId] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка сохранения"),
  });

  // Need users for member-type attribute selects
  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    enabled: (attrsQ.data ?? []).some((a) => a.data_type === "member"),
  });

  const valuesByAttrId = useMemo(() => {
    const m = new Map<string, AttributeValueRead>();
    for (const v of valsQ.data ?? []) m.set(v.attribute_id, v);
    return m;
  }, [valsQ.data]);

  const treeData = useMemo(() => {
    if (!attrsQ.data) return [];
    return buildTree(attrsQ.data);
  }, [attrsQ.data]);

  if (attrsQ.isLoading) return <Spin />;

  const realAttrs = (attrsQ.data ?? []).filter((a) => !a.is_group);
  if (realAttrs.length === 0) {
    return <Empty description="Нет атрибутов для этой сущности" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  // Count required attributes without a value
  const missingRequired = realAttrs.filter((a) => {
    if (!a.is_required) return false;
    const v = valuesByAttrId.get(a.id)?.value ?? a.default_value ?? null;
    return (
      v === null
      || v === undefined
      || v === ""
      || (Array.isArray(v) && v.length === 0)
    );
  });

  function commit(attr: AttributeRead, value: unknown) {
    setM.mutate({
      attribute_id: attr.id,
      entity_type: entityType,
      entity_id: entityId,
      value,
    });
  }

  return (
    <div>
      {missingRequired.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Не заполнено обязательных атрибутов: ${missingRequired.length}`}
          description={missingRequired.map((a) => a.name).join(", ")}
        />
      )}
      {treeData.map((node) => (
        <AttributeNode
          key={node.item.id}
          node={node}
          valuesByAttrId={valuesByAttrId}
          users={usersQ.data ?? []}
          onCommit={commit}
        />
      ))}
    </div>
  );
}

function AttributeNode({
  node,
  valuesByAttrId,
  users,
  onCommit,
  depth = 0,
}: {
  node: { item: AttributeRead; children: any[] };
  valuesByAttrId: Map<string, AttributeValueRead>;
  users: { id: string; email: string }[];
  onCommit: (attr: AttributeRead, value: unknown) => void;
  depth?: number;
}) {
  const attr = node.item;

  if (attr.is_group) {
    return (
      <Card
        size="small"
        title={
          <Space>
            <Typography.Text strong>{attr.name}</Typography.Text>
            {attr.description && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {attr.description}
              </Typography.Text>
            )}
          </Space>
        }
        style={{ marginBottom: 12, marginLeft: depth * 16 }}
      >
        {node.children.map((c) => (
          <AttributeNode
            key={c.item.id}
            node={c}
            valuesByAttrId={valuesByAttrId}
            users={users}
            onCommit={onCommit}
            depth={depth + 1}
          />
        ))}
      </Card>
    );
  }

  const valueRow = valuesByAttrId.get(attr.id);
  const currentValue = valueRow?.value ?? attr.default_value ?? null;
  const isEmpty =
    currentValue === null
    || currentValue === undefined
    || currentValue === ""
    || (Array.isArray(currentValue) && currentValue.length === 0);
  const requiredMissing = attr.is_required && isEmpty;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 0",
        background: requiredMissing ? "rgba(238, 52, 36, 0.05)" : undefined,
        borderRadius: 4,
        paddingLeft: requiredMissing ? 8 : 0,
        marginLeft: depth * 16,
      }}
    >
      <div style={{ minWidth: 200 }}>
        <Typography.Text>{attr.name}</Typography.Text>
        {attr.is_required && <Tag color="red" style={{ marginLeft: 6 }}>*</Tag>}
        <div style={{ fontSize: 11, color: "#999" }}>
          {attr.description || <em>{attr.code}</em>}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <ValueInput
          attr={attr}
          value={currentValue}
          users={users}
          onChange={(v) => onCommit(attr, v)}
        />
      </div>
    </div>
  );
}

function ValueInput({
  attr,
  value,
  users,
  onChange,
}: {
  attr: AttributeRead;
  value: unknown;
  users: { id: string; email: string }[];
  onChange: (v: unknown) => void;
}) {
  switch (attr.data_type) {
    case "boolean":
      return (
        <Switch checked={!!value} onChange={(checked) => onChange(checked)} />
      );

    case "number":
      return (
        <InputNumber
          value={(value as number) ?? null}
          onChange={(v) => onChange(v ?? null)}
          style={{ width: "100%" }}
        />
      );

    case "enum":
      if (attr.source_dictionary_id) {
        return (
          <DictItemSelect
            dictId={attr.source_dictionary_id}
            value={(value as string) ?? null}
            onChange={onChange}
          />
        );
      }
      return (
        <Select
          allowClear
          value={(value as string) ?? null}
          onChange={(v) => onChange(v ?? null)}
          options={(attr.enum_values ?? []).map((v) => ({ value: v, label: v }))}
          style={{ width: "100%" }}
        />
      );

    case "date":
      return (
        <DatePicker
          value={value ? dayjs(value as string) : null}
          onChange={(d) => onChange(d ? d.toISOString() : null)}
          showTime
          style={{ width: "100%" }}
        />
      );

    case "link":
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="https://example.com"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && !/^https?:\/\//.test(v)) {
              notify.warning("Ссылка должна начинаться с http:// или https://");
            }
          }}
        />
      );

    case "member":
      return (
        <Select
          showSearch
          allowClear
          value={(value as string) ?? null}
          onChange={(v) => onChange(v ?? null)}
          options={users.map((u) => ({ value: u.id, label: u.email }))}
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: "100%" }}
        />
      );

    case "string":
    default:
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}

/**
 * Dropdown sourced from a per-workspace custom dictionary.
 *
 * For "linear" dictionaries — flat option list.
 * For "hierarchical" — uses TreeSelect-style indentation (rendered via
 * Select with indented labels, since values stored are item ids).
 */
function DictItemSelect({
  dictId,
  value,
  onChange,
}: {
  dictId: string;
  value: string | null;
  onChange: (v: unknown) => void;
}) {
  const itemsQ = useQuery({
    queryKey: ["custom-dict-items", dictId],
    queryFn: () => listDictionaryItems(dictId),
  });

  const options = useMemo(() => {
    if (!itemsQ.data) return [];
    // Detect kind: if any item has parent_id, it's hierarchical
    const hierarchical = itemsQ.data.some((it) => it.parent_id);
    if (!hierarchical) {
      return itemsQ.data
        .filter((it) => !it.is_group)
        .map((it) => ({ value: it.id, label: it.name }));
    }
    // Hierarchical: build indented flat list
    const tree = buildTree(itemsQ.data);
    const opts: { value: string; label: string; disabled?: boolean }[] = [];
    function walk(nodes: any[], depth: number) {
      for (const n of nodes) {
        opts.push({
          value: n.item.id,
          label: "—".repeat(depth) + " " + n.item.name,
          disabled: n.item.is_group,
        });
        if (n.children) walk(n.children, depth + 1);
      }
    }
    walk(tree, 0);
    return opts;
  }, [itemsQ.data]);

  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={(v) => onChange(v ?? null)}
      loading={itemsQ.isLoading}
      options={options}
      filterOption={(input, option) =>
        (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
      }
      style={{ width: "100%" }}
    />
  );
}

