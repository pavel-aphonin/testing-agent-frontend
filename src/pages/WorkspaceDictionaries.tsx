import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  TagOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import {
  createCustomDictionary,
  createDictionaryItem,
  deleteCustomDictionary,
  deleteDictionaryItem,
  listCustomDictionaries,
  listDictionaryItems,
  listDictionaryPermissions,
  removeDictionaryPermission,
  updateCustomDictionary,
  updateDictionaryItem,
  upsertDictionaryPermission,
} from "@/api/customDictionaries";
import { listAdminUsers } from "@/api/users";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type {
  CustomDictionaryItemRead,
  CustomDictionaryRead,
} from "@/types";
import { buildTree } from "@/utils/tree";
import { notify } from "@/utils/notify";

interface DictRow extends CustomDictionaryRead {
  children?: DictRow[];
  key: string;
}
interface ItemRow extends CustomDictionaryItemRead {
  children?: ItemRow[];
  key: string;
}

export function WorkspaceDictionaries() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [selectedDictId, setSelectedDictId] = useState<string | null>(null);
  const [dictDrawerOpen, setDictDrawerOpen] = useState(false);
  const [editingDict, setEditingDict] = useState<CustomDictionaryRead | null>(null);
  const [permModalDict, setPermModalDict] = useState<CustomDictionaryRead | null>(null);

  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomDictionaryItemRead | null>(null);
  const [, setParentItemId] = useState<string | null>(null);

  const [dictForm] = Form.useForm();
  const [itemForm] = Form.useForm();

  const dictsQ = useQuery({
    queryKey: ["custom-dicts", ws?.id ?? "none"],
    queryFn: () => (ws ? listCustomDictionaries(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const selectedDict = (dictsQ.data ?? []).find((d) => d.id === selectedDictId) ?? null;

  const itemsQ = useQuery({
    queryKey: ["custom-dict-items", selectedDictId ?? "none"],
    queryFn: () => (selectedDictId ? listDictionaryItems(selectedDictId) : Promise.resolve([])),
    enabled: Boolean(selectedDictId),
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const createDictM = useMutation({
    mutationFn: createCustomDictionary,
    onSuccess: (d) => {
      notify.success("Справочник создан");
      qc.invalidateQueries({ queryKey: ["custom-dicts"] });
      setSelectedDictId(d.id);
      closeDictDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateDictM = useMutation({
    mutationFn: ({ id, ...rest }: any) => updateCustomDictionary(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["custom-dicts"] });
      closeDictDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteDictM = useMutation({
    mutationFn: deleteCustomDictionary,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["custom-dicts"] });
      setSelectedDictId(null);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const createItemM = useMutation({
    mutationFn: ({ dictId, ...payload }: any) => createDictionaryItem(dictId, payload),
    onSuccess: () => {
      notify.success("Элемент добавлен");
      qc.invalidateQueries({ queryKey: ["custom-dict-items"] });
      closeItemDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const updateItemM = useMutation({
    mutationFn: ({ id, ...rest }: any) => updateDictionaryItem(id, rest),
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["custom-dict-items"] });
      closeItemDrawer();
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const deleteItemM = useMutation({
    mutationFn: deleteDictionaryItem,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["custom-dict-items"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // ── Tree builders ──────────────────────────────────────────────────────
  const dictTree = useMemo<DictRow[]>(() => {
    if (!dictsQ.data) return [];
    const tree = buildTree(dictsQ.data);
    function toRow(node: any): DictRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [dictsQ.data]);

  const itemsTree = useMemo<ItemRow[]>(() => {
    if (!itemsQ.data || !selectedDict) return [];
    if (selectedDict.kind === "linear") {
      return itemsQ.data.map((it) => ({ ...it, key: it.id }));
    }
    const tree = buildTree(itemsQ.data);
    function toRow(node: any): ItemRow {
      return {
        ...node.item,
        key: node.item.id,
        children: node.children.length > 0 ? node.children.map(toRow) : undefined,
      };
    }
    return tree.map(toRow);
  }, [itemsQ.data, selectedDict]);

  // ── Handlers ───────────────────────────────────────────────────────────
  function openCreateDict() {
    setEditingDict(null);
    dictForm.resetFields();
    dictForm.setFieldsValue({ kind: "linear", is_restricted: false });
    setDictDrawerOpen(true);
  }
  function openEditDict(d: CustomDictionaryRead) {
    setEditingDict(d);
    dictForm.setFieldsValue({
      code: d.code,
      name: d.name,
      description: d.description ?? "",
      kind: d.kind,
      is_restricted: d.is_restricted,
    });
    setDictDrawerOpen(true);
  }
  function closeDictDrawer() {
    setDictDrawerOpen(false);
    setEditingDict(null);
    dictForm.resetFields();
  }

  function submitDict(values: any) {
    if (!ws) return;
    if (editingDict) {
      updateDictM.mutate({
        id: editingDict.id,
        name: values.name,
        description: values.description || null,
        is_restricted: values.is_restricted,
      });
    } else {
      createDictM.mutate({
        workspace_id: ws.id,
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        kind: values.kind,
        is_restricted: values.is_restricted,
      });
    }
  }

  function openCreateItem(parentId: string | null = null) {
    setEditingItem(null);
    setParentItemId(parentId);
    itemForm.resetFields();
    itemForm.setFieldsValue({ parent_id: parentId, sort_order: 0, is_group: false });
    setItemDrawerOpen(true);
  }
  function openEditItem(item: CustomDictionaryItemRead) {
    setEditingItem(item);
    setParentItemId(null);
    itemForm.setFieldsValue({
      code: item.code ?? "",
      name: item.name,
      description: item.description ?? "",
      parent_id: item.parent_id,
      sort_order: item.sort_order,
      is_group: item.is_group,
    });
    setItemDrawerOpen(true);
  }
  function closeItemDrawer() {
    setItemDrawerOpen(false);
    setEditingItem(null);
    setParentItemId(null);
    itemForm.resetFields();
  }

  function submitItem(values: any) {
    if (!selectedDict) return;
    const payload: any = {
      code: values.code || null,
      name: values.name,
      description: values.description || null,
      sort_order: values.sort_order ?? 0,
    };
    if (selectedDict.kind === "hierarchical") {
      payload.parent_id = values.parent_id ?? null;
      payload.is_group = !!values.is_group;
    }
    if (editingItem) {
      updateItemM.mutate({ id: editingItem.id, ...payload });
    } else {
      createItemM.mutate({ dictId: selectedDict.id, ...payload });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (!ws) {
    return <Alert type="info" message="Выберите рабочее пространство" showIcon />;
  }

  // Parent options for hierarchical items (only groups)
  const itemParentOptions = (itemsQ.data ?? [])
    .filter((it) => it.is_group)
    .map((it) => ({ value: it.id, label: it.name }));

  return (
    <>
      <div style={{ display: "flex", gap: 16 }}>
        {/* LEFT: dictionaries list */}
        <Card
          size="small"
          title={
            <Space>
              <span>Справочники</span>
              <Badge count={dictsQ.data?.length ?? 0} />
            </Space>
          }
          extra={
            <Space size="small">
              <Tooltip title="Обновить">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => qc.invalidateQueries({ queryKey: ["custom-dicts"] })}
                />
              </Tooltip>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateDict}
              >
                Новый
              </Button>
            </Space>
          }
          style={{ width: 360, flexShrink: 0 }}
          styles={{ body: { padding: 0 } }}
        >
          {(dictsQ.data?.length ?? 0) === 0 ? (
            <Empty description="Справочников нет" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
          ) : (
            <List
              dataSource={dictTree}
              renderItem={(d) => (
                <DictListItem
                  d={d}
                  selectedId={selectedDictId}
                  onSelect={setSelectedDictId}
                  onEdit={openEditDict}
                  onDelete={(id) => deleteDictM.mutate(id)}
                  onPerms={setPermModalDict}
                  myUserId={me?.id ?? ""}
                  depth={0}
                />
              )}
            />
          )}
        </Card>

        {/* RIGHT: items of selected dictionary */}
        <Card
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          title={
            selectedDict ? (
              <Space>
                <Typography.Text strong>{selectedDict.name}</Typography.Text>
                <Tag color={selectedDict.kind === "hierarchical" ? "purple" : "blue"}>
                  {selectedDict.kind === "hierarchical" ? "Иерархический" : "Линейный"}
                </Tag>
                {selectedDict.is_restricted && (
                  <Tooltip title="Доступ ограничен">
                    <Tag color="red" icon={<LockOutlined />}>ACL</Tag>
                  </Tooltip>
                )}
              </Space>
            ) : (
              "Элементы"
            )
          }
          extra={
            selectedDict && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openCreateItem(null)}
              >
                Добавить элемент
              </Button>
            )
          }
        >
          {!selectedDict ? (
            <Empty description="Выберите справочник слева" />
          ) : (
            <ItemsTable
              kind={selectedDict.kind}
              items={itemsTree}
              loading={itemsQ.isLoading}
              onAddChild={openCreateItem}
              onEdit={openEditItem}
              onDelete={(id) => deleteItemM.mutate(id)}
            />
          )}
        </Card>
      </div>

      {/* Dictionary drawer */}
      <Drawer
        title={editingDict ? `Редактирование: ${editingDict.name}` : "Новый справочник"}
        open={dictDrawerOpen}
        onClose={closeDictDrawer}
        width={480}
        extra={
          <Button
            type="primary"
            loading={createDictM.isPending || updateDictM.isPending}
            onClick={() => dictForm.submit()}
          >
            {editingDict ? "Сохранить" : "Создать"}
          </Button>
        }
      >
        <Form form={dictForm} layout="vertical" onFinish={submitDict}>
          {!editingDict && (
            <Form.Item
              name="code"
              label="Код"
              rules={[
                { required: true, message: "Обязательно" },
                { pattern: /^[a-z][a-z0-9_]*$/, message: "Только a-z, 0-9, _" },
              ]}
            >
              <Input placeholder="cities" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Города" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          {!editingDict && (
            <Form.Item name="kind" label="Тип справочника" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="linear">
                  <UnorderedListOutlined /> Линейный (плоский список)
                </Radio>
                <Radio value="hierarchical">
                  <ApartmentOutlined /> Иерархический (с группами)
                </Radio>
              </Radio.Group>
            </Form.Item>
          )}
          <Form.Item
            name="is_restricted"
            valuePropName="checked"
            extra="Когда включено — доступ только тем, кому явно выдан"
          >
            <Checkbox>
              <LockOutlined /> Ограничить доступ (персональные права)
            </Checkbox>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Item drawer */}
      <Drawer
        title={
          editingItem
            ? `Редактирование: ${editingItem.name}`
            : selectedDict?.kind === "hierarchical"
            ? "Новый элемент / группа"
            : "Новый элемент"
        }
        open={itemDrawerOpen}
        onClose={closeItemDrawer}
        width={480}
        extra={
          <Button
            type="primary"
            loading={createItemM.isPending || updateItemM.isPending}
            onClick={() => itemForm.submit()}
          >
            {editingItem ? "Сохранить" : "Создать"}
          </Button>
        }
      >
        <Form form={itemForm} layout="vertical" onFinish={submitItem}>
          <Form.Item name="code" label="Код (опционально)">
            <Input placeholder="msk" />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Москва" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          {selectedDict?.kind === "hierarchical" && (
            <>
              <Form.Item name="parent_id" label="Родительская группа">
                <Select
                  allowClear
                  placeholder="Корневой уровень"
                  options={itemParentOptions}
                />
              </Form.Item>
              <Form.Item name="is_group" valuePropName="checked">
                <Checkbox>Это группа (контейнер для других элементов)</Checkbox>
              </Form.Item>
            </>
          )}
          <Form.Item name="sort_order" label="Порядок сортировки">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Drawer>

      {permModalDict && (
        <PermissionsModal
          dict={permModalDict}
          onClose={() => setPermModalDict(null)}
        />
      )}
    </>
  );
}

// ── DictListItem ──────────────────────────────────────────────────────────
function DictListItem({
  d,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onPerms,
  myUserId,
  depth,
}: {
  d: DictRow;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (d: CustomDictionaryRead) => void;
  onDelete: (id: string) => void;
  onPerms: (d: CustomDictionaryRead) => void;
  myUserId: string;
  depth: number;
}) {
  const isSelected = d.id === selectedId;
  return (
    <>
      <List.Item
        style={{
          padding: "8px 12px",
          paddingLeft: 12 + depth * 16,
          background: isSelected ? "#FFF8F6" : undefined,
          cursor: d.is_group ? "default" : "pointer",
          borderLeft: isSelected ? "3px solid #EE3424" : "3px solid transparent",
        }}
        onClick={() => !d.is_group && onSelect(d.id)}
      >
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space size={6}>
            {d.is_group ? <FolderOutlined /> : d.kind === "hierarchical" ? <ApartmentOutlined /> : <UnorderedListOutlined />}
            <span style={{ fontWeight: isSelected ? 600 : 400 }}>{d.name}</span>
            {d.is_restricted && <LockOutlined style={{ color: "#cf1322" }} />}
          </Space>
          <Space size={2}>
            <Tooltip title="Права доступа">
              <Button
                size="small"
                type="text"
                icon={<UserOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onPerms(d);
                }}
              />
            </Tooltip>
            <Tooltip title="Редактировать">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(d);
                }}
              />
            </Tooltip>
            <Popconfirm
              title="Удалить?"
              onConfirm={() => onDelete(d.id)}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </Space>
      </List.Item>
      {d.children?.map((c) => (
        <DictListItem
          key={c.id}
          d={c}
          selectedId={selectedId}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onPerms={onPerms}
          myUserId={myUserId}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

// ── ItemsTable ────────────────────────────────────────────────────────────
function ItemsTable({
  kind,
  items,
  loading,
  onAddChild,
  onEdit,
  onDelete,
}: {
  kind: string;
  items: ItemRow[];
  loading: boolean;
  onAddChild: (parentId: string | null) => void;
  onEdit: (item: CustomDictionaryItemRead) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnsType<ItemRow> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (name: string, rec: ItemRow) => (
        <Space>
          {kind === "hierarchical" ? (
            rec.is_group ? <FolderOutlined style={{ color: "#EE3424" }} /> : <TagOutlined />
          ) : (
            <TagOutlined />
          )}
          <span style={{ fontWeight: rec.is_group ? 600 : 400 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (v: string | null) => (v ? <Typography.Text code>{v}</Typography.Text> : "—"),
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Действия",
      key: "actions",
      width: 160,
      render: (_: unknown, rec: ItemRow) => (
        <Space size="small">
          {kind === "hierarchical" && rec.is_group && (
            <Tooltip title="Добавить в эту группу">
              <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(rec.id)} />
            </Tooltip>
          )}
          <Tooltip title="Редактировать">
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(rec)} />
          </Tooltip>
          <Popconfirm
            title="Удалить?"
            onConfirm={() => onDelete(rec.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table<ItemRow>
      rowKey="key"
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={false}
      size="small"
      expandable={kind === "hierarchical" ? { defaultExpandAllRows: true } : undefined}
    />
  );
}

// ── PermissionsModal ──────────────────────────────────────────────────────
function PermissionsModal({
  dict,
  onClose,
}: {
  dict: CustomDictionaryRead;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const permsQ = useQuery({
    queryKey: ["dict-perms", dict.id],
    queryFn: () => listDictionaryPermissions(dict.id),
  });
  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
  });

  const upsertM = useMutation({
    mutationFn: (payload: { user_id: string; can_view: boolean; can_edit: boolean }) =>
      upsertDictionaryPermission(dict.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dict-perms", dict.id] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const removeM = useMutation({
    mutationFn: (userId: string) => removeDictionaryPermission(dict.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dict-perms", dict.id] }),
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const existingUserIds = new Set((permsQ.data ?? []).map((p) => p.user_id));
  const availableUsers = (usersQ.data ?? []).filter((u) => !existingUserIds.has(u.id));

  return (
    <Modal
      title={`Права: ${dict.name}`}
      open
      onCancel={onClose}
      footer={null}
      width={640}
    >
      {!dict.is_restricted && (
        <Alert
          type="info"
          message="Доступ открыт всем участникам пространства"
          description="Чтобы права заработали — включите «Ограничить доступ» в настройках справочника."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card size="small" title="Добавить пользователя" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: "100%" }}>
          <Select
            showSearch
            value={selectedUserId}
            onChange={setSelectedUserId}
            placeholder="Выберите пользователя"
            style={{ flex: 1 }}
            options={availableUsers.map((u) => ({ value: u.id, label: u.email }))}
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
          <Button
            type="primary"
            disabled={!selectedUserId}
            onClick={() => {
              if (selectedUserId) {
                upsertM.mutate({
                  user_id: selectedUserId,
                  can_view: true,
                  can_edit: false,
                });
                setSelectedUserId(null);
              }
            }}
          >
            Добавить
          </Button>
        </Space.Compact>
      </Card>

      <Table
        size="small"
        rowKey="user_id"
        dataSource={permsQ.data ?? []}
        loading={permsQ.isLoading}
        pagination={false}
        columns={[
          { title: "Email", dataIndex: "user_email" },
          {
            title: "Просматривать",
            dataIndex: "can_view",
            width: 130,
            render: (v: boolean, rec: any) => (
              <Switch
                checked={v}
                onChange={(checked) =>
                  upsertM.mutate({
                    user_id: rec.user_id,
                    can_view: checked,
                    can_edit: checked ? rec.can_edit : false,
                  })
                }
              />
            ),
          },
          {
            title: "Редактировать",
            dataIndex: "can_edit",
            width: 130,
            render: (v: boolean, rec: any) => (
              <Switch
                checked={v}
                onChange={(checked) =>
                  upsertM.mutate({
                    user_id: rec.user_id,
                    can_view: checked || rec.can_view,
                    can_edit: checked,
                  })
                }
              />
            ),
          },
          {
            title: "",
            key: "del",
            width: 60,
            render: (_: unknown, rec: any) => (
              <Popconfirm
                title="Убрать?"
                onConfirm={() => removeM.mutate(rec.user_id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Modal>
  );
}
