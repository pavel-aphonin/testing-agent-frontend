import { SettingOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Dropdown, Space, Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { getTablePrefs, setTablePrefs } from "@/api/tablePrefs";

export interface DataTableColumn<T> {
  key: string;
  title: string;
  dataIndex?: keyof T | string;
  width?: number | string;
  /** When true, column is included in the user-visible setting toggle. */
  toggleable?: boolean;
  /** When false, column is hidden by default (user can show it). */
  defaultVisible?: boolean;
  /** Pass through to AntD Column. */
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: { text: string; value: string | number | boolean }[];
  onFilter?: (value: string | number | boolean, record: T) => boolean;
  ellipsis?: boolean;
  fixed?: "left" | "right";
}

interface Props<T> extends Omit<TableProps<T>, "columns"> {
  /** Stable storage key, e.g. "runs", "users", "dict.roles" */
  tableKey: string;
  columns: DataTableColumn<T>[];
  /** When true, renders the column-settings dropdown above the table. */
  showColumnSettings?: boolean;
  /** Extra toolbar slot above the table (right side) */
  toolbar?: React.ReactNode;
}

/**
 * AntD Table wrapped with:
 *  - per-user persisted column visibility (PUT /api/me/table-prefs)
 *  - sortable columns (sorter passed through)
 *  - filterable columns (filters passed through)
 *  - column settings dropdown (admins call it "view picker")
 *
 * Sorting and filter state intentionally NOT persisted — those are
 * usually transient. Column visibility IS persisted.
 */
export function DataTable<T extends object>({
  tableKey,
  columns,
  showColumnSettings = true,
  toolbar,
  ...rest
}: Props<T>) {
  const qc = useQueryClient();
  const prefsQ = useQuery({
    queryKey: ["table-prefs", tableKey],
    queryFn: () => getTablePrefs(tableKey),
  });

  // Visible columns: from prefs if present, otherwise defaultVisible flag
  const defaultVisible = useMemo(
    () => columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
    [columns],
  );

  const [visibleCols, setVisibleCols] = useState<string[] | null>(null);

  useEffect(() => {
    if (prefsQ.data) {
      setVisibleCols(prefsQ.data.visible_columns ?? defaultVisible);
    } else if (!prefsQ.isLoading) {
      setVisibleCols(defaultVisible);
    }
  }, [prefsQ.data, prefsQ.isLoading, defaultVisible]);

  const setPrefsM = useMutation({
    mutationFn: (cols: string[]) =>
      setTablePrefs(tableKey, { ...prefsQ.data, visible_columns: cols }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["table-prefs", tableKey] }),
  });

  const effectiveVisible = visibleCols ?? defaultVisible;
  const visibleSet = new Set(effectiveVisible);

  const filteredColumns = columns
    .filter((c) => visibleSet.has(c.key))
    .map((c) => ({
      key: c.key,
      title: c.title,
      dataIndex: c.dataIndex as any,
      width: c.width,
      render: c.render,
      sorter: c.sorter,
      filters: c.filters as any,
      onFilter: c.onFilter as any,
      ellipsis: c.ellipsis,
      fixed: c.fixed,
    })) as ColumnsType<T>;

  function toggleColumn(key: string, checked: boolean) {
    const next = checked
      ? [...effectiveVisible, key]
      : effectiveVisible.filter((k) => k !== key);
    setVisibleCols(next);
    setPrefsM.mutate(next);
  }

  const settingsItems = columns
    .filter((c) => c.toggleable !== false)
    .map((c) => ({
      key: c.key,
      label: (
        <Checkbox
          checked={visibleSet.has(c.key)}
          onChange={(e) => toggleColumn(c.key, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        >
          {c.title}
        </Checkbox>
      ),
    }));

  return (
    <div>
      <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 8 }}>
        {toolbar}
        {showColumnSettings && (
          <Dropdown
            menu={{ items: settingsItems }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />}>Колонки</Button>
          </Dropdown>
        )}
      </Space>
      <Table<T> columns={filteredColumns} {...rest} />
    </div>
  );
}
