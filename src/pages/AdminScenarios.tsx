import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { notify } from "@/utils/notify";
import {
  createScenario,
  deleteScenario,
  listScenarios,
  updateScenario,
} from "@/api/scenarios";
import { useWorkspaceStore } from "@/store/workspace";
import type { ScenarioCreate, ScenarioRead } from "@/types";

// ────────────────────────────── Types ──────────────────────────────

interface ScenarioStep {
  screen_name: string;
  action: "tap" | "input" | "swipe" | "wait" | "assert";
  element_label: string;
  value?: string;
  expected_result?: string;
}

const ACTION_OPTIONS = [
  { value: "tap", label: "Нажать" },
  { value: "input", label: "Ввести текст" },
  { value: "swipe", label: "Свайп" },
  { value: "wait", label: "Подождать" },
  { value: "assert", label: "Проверить" },
];

const ACTION_COLORS: Record<string, string> = {
  tap: "#1890ff", input: "#52c41a", swipe: "#faad14", wait: "#999", assert: "#eb2f96",
};
const ACTION_LABELS: Record<string, string> = {
  tap: "👆 Нажать", input: "⌨️ Ввести", swipe: "👉 Свайп", wait: "⏳ Ждать", assert: "✅ Проверить",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("ru-RU", { hour12: false });
  return `${day}.${month}.${year} ${time}`;
}

// ────────────────────────────── Step Editor (Constructor) ──────────

function StepEditor({
  steps,
  onChange,
}: {
  steps: ScenarioStep[];
  onChange: (steps: ScenarioStep[]) => void;
}) {
  const updateStep = (index: number, field: keyof ScenarioStep, value: string) => {
    const next = [...steps];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const addStep = () => {
    onChange([
      ...steps,
      { screen_name: "", action: "tap", element_label: "", value: "", expected_result: "" },
    ]);
  };

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8,
            padding: "8px 12px", background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0",
          }}
        >
          <div style={{ color: "#bbb", paddingTop: 5, cursor: "grab" }}><HolderOutlined /></div>
          <Tag style={{ marginTop: 4, minWidth: 24, textAlign: "center" }}>{i + 1}</Tag>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input size="small" placeholder="Экран" value={step.screen_name}
                onChange={(e) => updateStep(i, "screen_name", e.target.value)} style={{ width: 140 }} />
              <Select size="small" value={step.action}
                onChange={(v) => updateStep(i, "action", v)} options={ACTION_OPTIONS} style={{ width: 140 }} />
              <Input size="small" placeholder="Элемент" value={step.element_label}
                onChange={(e) => updateStep(i, "element_label", e.target.value)} style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(step.action === "input" || step.action === "swipe") && (
                <Input size="small"
                  placeholder={step.action === "input" ? "Значение или {{test_data.key}}" : "up/down/left/right"}
                  value={step.value}
                  onChange={(e) => updateStep(i, "value", e.target.value)} style={{ flex: 1 }} />
              )}
              <Input size="small" placeholder="Ожидаемый результат" value={step.expected_result}
                onChange={(e) => updateStep(i, "expected_result", e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <Button type="text" size="small" danger icon={<DeleteOutlined />}
            onClick={() => removeStep(i)} style={{ marginTop: 4 }} />
        </div>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addStep}
        style={{ width: "100%", marginTop: 4 }} size="small">
        Добавить шаг
      </Button>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
        💡 Используйте <Typography.Text code style={{ fontSize: 11 }}>{"{{test_data.email}}"}</Typography.Text> для подстановки данных из раздела «Тестовые данные»
      </Typography.Text>
    </div>
  );
}

// ────────────────────────────── Flow Nodes ──────────────────────────

function StartEndNode({ data }: { data: { label: string; color: string } }) {
  return (
    <div style={{
      width: 120, height: 44, borderRadius: 22,
      background: data.color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 600,
    }}>
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
      <Handle type="target" position={Position.Top} style={{ background: data.color }} />
    </div>
  );
}

function StepNode({ data }: { data: { step: ScenarioStep; index: number; onEdit: (i: number) => void } }) {
  const { step, index, onEdit } = data;
  const color = ACTION_COLORS[step.action] || "#1890ff";
  const isTestData = step.value?.includes("{{");

  return (
    <div
      onClick={() => onEdit(index)}
      style={{
        minWidth: 200, maxWidth: 280, padding: "10px 16px",
        borderRadius: 10, border: `2px solid ${color}`, background: "#fff",
        cursor: "pointer", fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Tag color={color} style={{ margin: 0, fontSize: 11 }}>{ACTION_LABELS[step.action]}</Tag>
        {step.screen_name && (
          <span style={{ fontSize: 10, color: "#999" }}>{step.screen_name}</span>
        )}
      </div>
      <div style={{ fontWeight: 600 }}>{step.element_label || "..."}</div>
      {step.value && (
        <div style={{ fontSize: 11, color: isTestData ? "#eb2f96" : "#666", marginTop: 2 }}>
          {isTestData ? `🔗 ${step.value}` : `= "${step.value}"`}
        </div>
      )}
      {step.expected_result && (
        <div style={{ fontSize: 11, color: "#52c41a", marginTop: 2 }}>✓ {step.expected_result}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  startEnd: StartEndNode,
  step: StepNode,
};

// ────────────────────────────── Flowchart Editor ──────────────────

function FlowchartEditor({
  steps,
  onChange,
}: {
  steps: ScenarioStep[];
  onChange: (steps: ScenarioStep[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();

  const onEdit = useCallback((i: number) => {
    setEditingIndex(i);
    editForm.setFieldsValue(steps[i]);
  }, [steps, editForm]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const ns: Node[] = [
      {
        id: "start", type: "startEnd", position: { x: 200, y: 0 },
        data: { label: "Начало", color: "#52c41a" }, draggable: true,
      },
    ];
    const es: Edge[] = [];

    steps.forEach((step, i) => {
      ns.push({
        id: `step-${i}`, type: "step",
        position: { x: 160, y: 80 + i * 130 },
        data: { step, index: i, onEdit },
        draggable: true,
      });
      es.push({
        id: `e-${i === 0 ? "start" : `step-${i - 1}`}-step-${i}`,
        source: i === 0 ? "start" : `step-${i - 1}`,
        target: `step-${i}`,
        animated: true,
        style: { stroke: "#d9d9d9", strokeWidth: 2 },
      });
    });

    const endY = 80 + steps.length * 130;
    ns.push({
      id: "end", type: "startEnd", position: { x: 200, y: endY },
      data: { label: "Конец", color: "#ff4d4f" }, draggable: true,
    });
    if (steps.length > 0) {
      es.push({
        id: `e-step-${steps.length - 1}-end`,
        source: `step-${steps.length - 1}`, target: "end",
        animated: true, style: { stroke: "#d9d9d9", strokeWidth: 2 },
      });
    } else {
      es.push({
        id: "e-start-end", source: "start", target: "end",
        animated: true, style: { stroke: "#d9d9d9", strokeWidth: 2 },
      });
    }

    return { initialNodes: ns, initialEdges: es };
  }, [steps, onEdit]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when steps change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleEditSave = () => {
    if (editingIndex === null) return;
    const values = editForm.getFieldsValue();
    const next = [...steps];
    next[editingIndex] = { ...next[editingIndex], ...values };
    onChange(next);
    setEditingIndex(null);
  };

  const handleEditDelete = () => {
    if (editingIndex === null) return;
    onChange(steps.filter((_, i) => i !== editingIndex));
    setEditingIndex(null);
  };

  const handleAddStep = () => {
    onChange([
      ...steps,
      { screen_name: "", action: "tap", element_label: "", value: "", expected_result: "" },
    ]);
  };

  return (
    <>
      <div style={{
        height: 500, border: "1px solid #f0f0f0", borderRadius: 8,
        background: "#fafafa", position: "relative",
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAddStep}
          style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10 }}
        >
          Добавить шаг
        </Button>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
        Нажмите на шаг для редактирования. Узлы можно перетаскивать.
      </Typography.Text>

      {/* Edit step modal */}
      <Modal
        open={editingIndex !== null}
        title={editingIndex !== null ? `Шаг ${editingIndex + 1}` : ""}
        onCancel={() => setEditingIndex(null)}
        onOk={handleEditSave}
        okText="Применить"
        cancelText="Отмена"
        width={480}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button danger onClick={handleEditDelete}>Удалить шаг</Button>
            <Space><CancelBtn /><OkBtn /></Space>
          </div>
        )}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="screen_name" label="Экран">
            <Input placeholder="Login, Profile, Settings..." />
          </Form.Item>
          <Form.Item name="action" label="Действие">
            <Select options={ACTION_OPTIONS} />
          </Form.Item>
          <Form.Item name="element_label" label="Элемент">
            <Input placeholder="Кнопка, поле, переключатель..." />
          </Form.Item>
          <Form.Item name="value" label="Значение">
            <Input placeholder="Текст или {{test_data.key}}" />
          </Form.Item>
          <Form.Item name="expected_result" label="Ожидаемый результат">
            <Input placeholder="Что должно произойти" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ────────────────────────────── Main Page ──────────────────────────

export function AdminScenarios() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [editorMode, setEditorMode] = useState<string>("constructor");

  const workspace = useWorkspaceStore((s) => s.current);
  const scenariosQuery = useQuery({
    queryKey: ["scenarios", workspace?.id ?? "none"],
    queryFn: () => listScenarios(workspace?.id),
  });

  const selected = scenariosQuery.data?.find((s) => s.id === selectedId) ?? null;

  const createMutation = useMutation({
    mutationFn: (payload: ScenarioCreate) =>
      createScenario({ ...payload, workspace_id: workspace?.id }),
    onSuccess: (created) => {
      notify.success(t("scenarios.created"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedId(created.id);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("scenarios.createFailed");
      notify.error(detail);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateScenario(id, payload),
    onSuccess: () => {
      notify.success(t("scenarios.saved"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("scenarios.saveFailed");
      notify.error(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => {
      notify.success(t("scenarios.deleted"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      if (selectedId) setSelectedId(null);
    },
    onError: () => { notify.error(t("scenarios.deleteFailed")); },
  });

  const handleCreate = () => {
    createMutation.mutate({ title: t("scenarios.newScenarioTitle"), steps_json: { steps: [] } });
  };

  const handleToggleActive = (scenario: ScenarioRead) => {
    updateMutation.mutate({ id: scenario.id, payload: { is_active: !scenario.is_active } });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const scenario = scenariosQuery.data?.find((s) => s.id === id);
    if (scenario) {
      setSteps((scenario.steps_json as { steps?: ScenarioStep[] })?.steps ?? []);
      form.setFieldsValue({
        title: scenario.title,
        description: scenario.description ?? "",
      });
    }
  };

  const handleSave = () => {
    if (!selectedId) return;
    form.validateFields().then((values) => {
      const cleanSteps = steps.map((s) => {
        const clean: ScenarioStep = { screen_name: s.screen_name, action: s.action, element_label: s.element_label };
        if (s.value?.trim()) clean.value = s.value.trim();
        if (s.expected_result?.trim()) clean.expected_result = s.expected_result.trim();
        return clean;
      });
      updateMutation.mutate({
        id: selectedId,
        payload: { title: values.title, description: values.description || undefined, steps_json: { steps: cleanSteps } },
      });
    });
  };

  const columns: ColumnsType<ScenarioRead> = [
    { title: t("scenarios.columns.title"), dataIndex: "title", key: "title", ellipsis: true,
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text> },
    { title: t("scenarios.columns.active"), dataIndex: "is_active", key: "is_active", width: 80,
      render: (_: boolean, record: ScenarioRead) => (
        <Switch size="small" checked={record.is_active} onChange={() => handleToggleActive(record)} />
      ) },
    { title: "", key: "actions", width: 50,
      render: (_, record) => (
        <Popconfirm title={t("scenarios.deleteConfirm")} onConfirm={() => deleteMutation.mutate(record.id)}
          okText={t("common.delete")} okButtonProps={{ danger: true }}>
          <Button danger type="text" icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ) },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>{t("scenarios.title")}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} loading={createMutation.isPending}>
          {t("scenarios.createScenario")}
        </Button>
      </Space>

      <Row gutter={24}>
        <Col span={8}>
          <Table<ScenarioRead>
            rowKey="id" loading={scenariosQuery.isLoading} columns={columns}
            dataSource={scenariosQuery.data ?? []} pagination={{ pageSize: 20 }} size="small"
            onRow={(record) => ({
              onClick: () => handleSelect(record.id),
              style: { cursor: "pointer", background: record.id === selectedId ? "#e6f4ff" : undefined },
            })}
          />
        </Col>

        <Col span={16}>
          {selected ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatDate(selected.created_at)}</Typography.Text>
                  <Tag color={selected.is_active ? "green" : undefined}>
                    {selected.is_active ? t("scenarios.statusActive") : t("scenarios.statusInactive")}
                  </Tag>
                </Space>
                <Segmented
                  size="small"
                  value={editorMode}
                  onChange={(v) => setEditorMode(v as string)}
                  options={[
                    { value: "constructor", label: "Конструктор" },
                    { value: "flowchart", label: "Блок-схема" },
                    { value: "json", label: "JSON" },
                  ]}
                />
              </div>

              <Form form={form} layout="vertical">
                <Form.Item name="title" label={t("scenarios.titleLabel")}
                  rules={[{ required: true, message: t("scenarios.titleRequired") }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="description" label={t("scenarios.descriptionLabel")}>
                  <Input.TextArea rows={2} />
                </Form.Item>

                {editorMode === "json" ? (
                  <Form.Item label="JSON">
                    <Input.TextArea
                      rows={16}
                      style={{ fontFamily: "monospace", fontSize: 13 }}
                      value={JSON.stringify({ steps }, null, 2)}
                      onChange={(e) => {
                        try { const p = JSON.parse(e.target.value); setSteps(p.steps ?? []); } catch { /* ignore while typing */ }
                      }}
                    />
                  </Form.Item>
                ) : editorMode === "flowchart" ? (
                  <Form.Item label={`Блок-схема (${steps.length} шагов)`}>
                    <FlowchartEditor steps={steps} onChange={setSteps} />
                  </Form.Item>
                ) : (
                  <Form.Item label={`Шаги (${steps.length})`}>
                    <StepEditor steps={steps} onChange={setSteps} />
                  </Form.Item>
                )}

                <Button type="primary" onClick={handleSave} loading={updateMutation.isPending}>
                  {t("common.save")}
                </Button>
              </Form>
            </div>
          ) : (
            <div style={{ textAlign: "center", paddingTop: 80, color: "#999" }}>
              {t("scenarios.selectHint")}
            </div>
          )}
        </Col>
      </Row>
    </>
  );
}
