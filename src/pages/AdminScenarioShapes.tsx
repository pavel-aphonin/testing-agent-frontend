/**
 * Admin page for managing the scenario-shapes dictionary (PER-90).
 *
 * Lists every shape (built-in + custom) with code, name, category,
 * geometry, colour, icon, attached action verb, and the count of
 * attributes. Built-ins are flagged with a "Встроенная" tag; their
 * row's delete button is hidden and the structural fields (code,
 * category, geometry) are locked in the edit drawer.
 *
 * Drawer is full-form: every shape attribute is editable inline via
 * a tiny dynamic table — no need to drop into JSON for typical
 * extension cases (add a new field, rename, change defaults).
 */

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  ColorPicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import {
  createScenarioShape,
  deleteScenarioShape,
  listScenarioShapes,
  updateScenarioShape,
} from "@/api/scenarioShapes";
import { LabelWithHint } from "@/components/LabelWithHint";
import { FALLBACK_ACTIONS } from "@/components/scenario/graph/useScenarioDictionaries";
import type {
  ScenarioShapeAttribute,
  ScenarioShapeRead,
} from "@/types";
import { notify } from "@/utils/notify";

const CATEGORIES = [
  { value: "start", label: "Начало" },
  { value: "end", label: "Конец" },
  { value: "action", label: "Действие" },
  { value: "decision", label: "Условие" },
  { value: "wait", label: "Пауза" },
  { value: "screen_check", label: "Проверить экран" },
  { value: "loop_back", label: "Возврат (цикл)" },
  { value: "sub_scenario", label: "Связанный сценарий" },
  { value: "group", label: "Группа" },
];

const GEOMETRIES = [
  { value: "circle", label: "Круг" },
  { value: "rect", label: "Прямоугольник" },
  { value: "diamond", label: "Ромб" },
  { value: "pill", label: "Овал (pill)" },
  { value: "trapezoid", label: "Трапеция" },
  { value: "hexagon", label: "Шестиугольник" },
  { value: "container", label: "Контейнер (группа)" },
];

const ATTR_TYPES = [
  { value: "string", label: "Строка / текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Переключатель" },
  { value: "action_verb", label: "Тип действия (из справочника)" },
  { value: "scenario_link", label: "Ссылка на сценарий" },
];

export function AdminScenarioShapes() {
  const qc = useQueryClient();
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ScenarioShapeRead | null>(null);
  const [form] = Form.useForm();

  const shapesQ = useQuery({
    queryKey: ["scenario-shapes"],
    queryFn: listScenarioShapes,
  });

  const createM = useMutation({
    mutationFn: createScenarioShape,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario-shapes"] });
      notify.success("Фигура создана");
      setDrawerOpen(false);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Не удалось создать"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateScenarioShape(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario-shapes"] });
      notify.success("Сохранено");
      setDrawerOpen(false);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Не удалось сохранить"),
  });

  const deleteM = useMutation({
    mutationFn: deleteScenarioShape,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario-shapes"] });
      notify.success("Удалено");
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Не удалось удалить"),
  });

  // Hydrate the form whenever the drawer opens or the editing target
  // changes. ``attributes`` is rendered via Form.List below, so we
  // pass it through model-as-is.
  useEffect(() => {
    if (!drawerOpen) return;
    form.setFieldsValue(
      editing
        ? {
            code: editing.code,
            name: editing.name,
            description: editing.description ?? "",
            category: editing.category,
            geometry: editing.geometry,
            color: editing.color,
            icon: editing.icon ?? "",
            action_code: editing.action_code ?? "",
            attributes: editing.attributes ?? [],
            sort_order: editing.sort_order,
          }
        : {
            code: "",
            name: "",
            description: "",
            category: "action",
            geometry: "rect",
            color: "#1677ff",
            icon: "",
            action_code: "tap",
            attributes: [],
            sort_order: 100,
          },
    );
  }, [drawerOpen, editing, form]);

  const columns: ColumnsType<ScenarioShapeRead> = useMemo(
    () => [
      {
        title: "",
        key: "swatch",
        width: 40,
        render: (_: unknown, r) => (
          <span
            style={{
              display: "inline-block",
              width: 18,
              height: 18,
              borderRadius: r.geometry === "circle" ? "50%" : 4,
              background: r.color,
              border: `1px solid ${token.colorBorder}`,
            }}
          />
        ),
      },
      {
        title: "Название",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_: unknown, r) => (
          <Space>
            <Typography.Text strong>{r.name}</Typography.Text>
            {r.is_builtin && (
              <Tag color="default" style={{ fontSize: 10 }}>
                встроенная
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: "Код",
        dataIndex: "code",
        key: "code",
        render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
      },
      {
        title: "Категория",
        dataIndex: "category",
        key: "category",
        filters: CATEGORIES.map((c) => ({ value: c.value, text: c.label })),
        onFilter: (v, r) => r.category === v,
        render: (v: string) =>
          CATEGORIES.find((c) => c.value === v)?.label ?? v,
      },
      {
        title: "Геометрия",
        dataIndex: "geometry",
        key: "geometry",
        render: (v: string) =>
          GEOMETRIES.find((g) => g.value === v)?.label ?? v,
      },
      {
        title: "Действие",
        dataIndex: "action_code",
        key: "action_code",
        render: (v: string | null) =>
          v ? <Typography.Text code>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
      },
      {
        title: "Полей",
        dataIndex: "attributes",
        key: "attributes_count",
        width: 80,
        render: (a: ScenarioShapeAttribute[]) => a?.length ?? 0,
      },
      {
        title: "Порядок",
        dataIndex: "sort_order",
        key: "sort_order",
        width: 90,
        sorter: (a, b) => a.sort_order - b.sort_order,
        defaultSortOrder: "ascend",
      },
      {
        title: "",
        key: "actions",
        width: 110,
        render: (_: unknown, r) => (
          <Space size="small">
            <Tooltip title="Редактировать">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(r);
                  setDrawerOpen(true);
                }}
              />
            </Tooltip>
            {!r.is_builtin && (
              <Popconfirm
                title="Удалить фигуру?"
                description="Сценарии, которые на неё ссылаются, перестанут отображать узлы корректно."
                onConfirm={() => deleteM.mutate(r.id)}
                okText="Удалить"
                okButtonProps={{ danger: true }}
                cancelText="Отмена"
              >
                <Tooltip title="Удалить">
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [token.colorBorder, deleteM],
  );

  const handleSave = async () => {
    const values = await form.validateFields();
    // ColorPicker returns a Color object — normalise to hex string.
    const colorHex =
      typeof values.color === "string"
        ? values.color
        : values.color?.toHexString?.() ?? "#1677ff";
    const payload = {
      ...values,
      color: colorHex,
      icon: values.icon || null,
      action_code: values.action_code || null,
      description: values.description || null,
      attributes: (values.attributes ?? []) as ScenarioShapeAttribute[],
    };
    if (editing) {
      updateM.mutate({ id: editing.id, payload });
    } else {
      createM.mutate(payload);
    }
  };

  return (
    <>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Фигуры сценариев
          </Typography.Title>
          <Typography.Text type="secondary">
            Палитра узлов визуального редактора. Встроенные фигуры можно
            переименовывать и менять им цвет/иконку, а пользовательские —
            создавать с нуля.
          </Typography.Text>
        </div>
        <Space>
          <Tooltip title="Обновить список">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => qc.invalidateQueries({ queryKey: ["scenario-shapes"] })}
              loading={shapesQ.isFetching && !shapesQ.isLoading}
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            Добавить фигуру
          </Button>
        </Space>
      </Space>

      <Table<ScenarioShapeRead>
        rowKey="id"
        loading={shapesQ.isLoading}
        dataSource={shapesQ.data ?? []}
        columns={columns}
        pagination={false}
        size="small"
      />

      <Drawer
        open={drawerOpen}
        title={
          editing ? `Редактирование: ${editing.name}` : "Новая фигура"
        }
        onClose={() => setDrawerOpen(false)}
        width={620}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button
              type="primary"
              loading={createM.isPending || updateM.isPending}
              onClick={handleSave}
            >
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label={
              <LabelWithHint
                label="Код"
                hint="Латиницей, без пробелов. Используется как стабильный id во всех сценариях, ссылающихся на эту фигуру."
              />
            }
            rules={[
              { required: true, message: "Код обязателен" },
              {
                pattern: /^[a-z][a-z0-9_]*$/,
                message: "Только латиница, цифры и _ (с буквы)",
              },
            ]}
          >
            <Input
              disabled={Boolean(editing?.is_builtin)}
              placeholder="open_dropdown"
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={<LabelWithHint label="Название" hint="Видно пользователю в палитре и подсказке." />}
            rules={[{ required: true, message: "Название обязательно" }]}
          >
            <Input placeholder="Открыть выпадающий список" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Когда использовать фигуру." />
          </Form.Item>
          <Space size="middle" style={{ width: "100%" }} align="start">
            <Form.Item
              name="category"
              label={<LabelWithHint label="Категория" hint="Определяет, что worker делает с этой фигурой во время выполнения." />}
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select
                disabled={Boolean(editing?.is_builtin)}
                options={CATEGORIES}
              />
            </Form.Item>
            <Form.Item
              name="geometry"
              label={<LabelWithHint label="Геометрия" hint="Как фигура рисуется на холсте." />}
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 200 }}
            >
              <Select
                disabled={Boolean(editing?.is_builtin)}
                options={GEOMETRIES}
              />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ width: "100%" }} align="start">
            <Form.Item name="color" label="Цвет">
              <ColorPicker />
            </Form.Item>
            <Form.Item
              name="icon"
              label={
                <LabelWithHint
                  label="Иконка"
                  hint="Имя компонента из @ant-design/icons, например ThunderboltOutlined, или эмодзи."
                />
              }
              style={{ flex: 1 }}
            >
              <Input placeholder="ThunderboltOutlined" />
            </Form.Item>
            <Form.Item name="sort_order" label="Порядок" style={{ width: 110 }}>
              <InputNumber min={0} max={9999} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.category !== cur.category}
          >
            {({ getFieldValue }) =>
              getFieldValue("category") === "action" ? (
                <Form.Item
                  name="action_code"
                  label={
                    <LabelWithHint
                      label="Действие воркера"
                      hint="Что worker реально выполнит, когда дойдёт до фигуры. Берётся из встроенного списка глаголов или пользовательского справочника."
                    />
                  }
                >
                  <Select
                    options={FALLBACK_ACTIONS.map((a) => ({
                      value: a.value,
                      label: `${a.label} (${a.value})`,
                    }))}
                    placeholder="tap"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Typography.Title level={5} style={{ marginTop: 8 }}>
            Поля редактора
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Какие поля видны в drawer-е при клике на узел этой фигуры.
            Ключ записывается в <code>node.data[ключ]</code>.
          </Typography.Paragraph>
          <Form.List name="attributes">
            {(fields, { add, remove }) => (
              <div>
                {fields.map((field) => (
                  <Space
                    key={field.key}
                    align="baseline"
                    style={{ display: "flex", marginBottom: 4 }}
                    wrap
                  >
                    <Form.Item
                      name={[field.name, "key"]}
                      rules={[{ required: true, message: "key" }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="key" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "label"]}
                      rules={[{ required: true, message: "label" }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="Подпись" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "type"]}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        options={ATTR_TYPES}
                        placeholder="тип"
                        style={{ width: 200 }}
                        defaultValue="string"
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </Space>
                ))}
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ type: "string" })}
                >
                  Добавить поле
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </>
  );
}
