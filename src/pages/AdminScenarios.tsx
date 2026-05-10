import {
  ArrowLeftOutlined,
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useBlocker } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { LabelWithHint } from "@/components/LabelWithHint";
import {
  createScenario,
  deleteScenario,
  listScenarios,
  updateScenario,
} from "@/api/scenarios";
import { listKnowledgeDocuments } from "@/api/knowledge";
import { listTestData } from "@/api/testData";
import { VarAutocompleteInput } from "@/components/VarAutocompleteInput";
import { JsonScenarioEditor } from "@/components/JsonScenarioEditor";
import { useWorkspaceStore } from "@/store/workspace";
import type { ScenarioCreate, ScenarioRead } from "@/types";

// ─────────────────────────── shared types + helpers ───────────────────────

const VarsCtx = createContext<{ key: string; value?: string }[]>([]);

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

// PER-70: tooltip text for each step field. Reused by both the
// Constructor (inline) and the Flowchart edit modal.
const HINTS = {
  screen_name:
    "Имя экрана как видит его агент после анализа интерфейса. Можно посмотреть в результатах предыдущего run-а: Login, Профиль, Настройки.",
  action:
    "Какое действие выполнить: tap (нажать), input (ввести текст), swipe (свайп), wait (подождать), assert (проверить).",
  element_label:
    "Текст или label элемента UI на который агент кликает. Берётся из accessibility tree приложения. Например: «Войти», «email-input», «Сохранить».",
  value:
    "Текст для action=input, или направление для swipe (up/down/left/right). Поддерживает подстановку из тестовых данных через {{test_data.email}}.",
  expected_result:
    "Что должно произойти после действия. Используется для автоматической RAG-сверки против документов базы знаний (если выбраны).",
  rag_documents:
    "Эталонные документы из базы знаний для RAG-сверки expected_result. Если ничего не выбрать — поиск идёт по всему корпусу пространства.",
} as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("ru-RU", { hour12: false });
  return `${day}.${month}.${year} ${time}`;
}

// ─────────────────────────── Step Editor (Constructor) ────────────────────

function StepEditor({
  steps,
  onChange,
}: {
  steps: ScenarioStep[];
  onChange: (steps: ScenarioStep[]) => void;
}) {
  const tdataVars = useContext(VarsCtx);
  const { token } = theme.useToken();

  const updateStep = (index: number, field: keyof ScenarioStep, value: string) => {
    const next = [...steps];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };
  const removeStep = (index: number) => onChange(steps.filter((_, i) => i !== index));
  const addStep = () =>
    onChange([
      ...steps,
      { screen_name: "", action: "tap", element_label: "", value: "", expected_result: "" },
    ]);

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            marginBottom: 8,
            padding: "8px 12px",
            // PER-67: AntD theme tokens instead of hard-coded #fafafa/#f0f0f0
            background: token.colorFillQuaternary,
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ color: token.colorTextDisabled, paddingTop: 5, cursor: "grab" }}>
            <HolderOutlined />
          </div>
          <Tag style={{ marginTop: 4, minWidth: 24, textAlign: "center" }}>{i + 1}</Tag>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Tooltip title={HINTS.screen_name} placement="top">
                <Input
                  size="small"
                  placeholder="Экран"
                  value={step.screen_name}
                  onChange={(e) => updateStep(i, "screen_name", e.target.value)}
                  style={{ width: 140 }}
                />
              </Tooltip>
              <Tooltip title={HINTS.action} placement="top">
                <Select
                  size="small"
                  value={step.action}
                  onChange={(v) => updateStep(i, "action", v)}
                  options={ACTION_OPTIONS}
                  style={{ width: 140 }}
                />
              </Tooltip>
              <Tooltip title={HINTS.element_label} placement="top">
                <Input
                  size="small"
                  placeholder="Элемент"
                  value={step.element_label}
                  onChange={(e) => updateStep(i, "element_label", e.target.value)}
                  style={{ flex: 1 }}
                />
              </Tooltip>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(step.action === "input" || step.action === "swipe") &&
                (step.action === "input" ? (
                  <div style={{ flex: 1 }}>
                    <Tooltip title={HINTS.value} placement="top">
                      <span>
                        <VarAutocompleteInput
                          size="small"
                          variables={tdataVars}
                          value={step.value ?? ""}
                          onChange={(v) => updateStep(i, "value", v)}
                          placeholder="Значение или {{test_data.key}}"
                        />
                      </span>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip title={HINTS.value} placement="top">
                    <Input
                      size="small"
                      placeholder="up/down/left/right"
                      value={step.value}
                      onChange={(e) => updateStep(i, "value", e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </Tooltip>
                ))}
              <Tooltip title={HINTS.expected_result} placement="top">
                <Input
                  size="small"
                  placeholder="Ожидаемый результат"
                  value={step.expected_result}
                  onChange={(e) => updateStep(i, "expected_result", e.target.value)}
                  style={{ flex: 1 }}
                />
              </Tooltip>
            </div>
          </div>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeStep(i)}
            style={{ marginTop: 4 }}
          />
        </div>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addStep}
        style={{ width: "100%", marginTop: 4 }}
        size="small"
      >
        Добавить шаг
      </Button>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
        💡 Используйте{" "}
        <Typography.Text code style={{ fontSize: 11 }}>
          {"{{test_data.email}}"}
        </Typography.Text>{" "}
        для подстановки данных из раздела «Тестовые данные»
      </Typography.Text>
    </div>
  );
}

// ─────────────────────────── Flow Nodes ──────────────────────────────────

function StartEndNode({ data }: { data: { label: string; color: string } }) {
  return (
    <div
      style={{
        width: 120,
        height: 44,
        borderRadius: 22,
        background: data.color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
      <Handle type="target" position={Position.Top} style={{ background: data.color }} />
    </div>
  );
}

function StepNode({ data }: { data: { step: ScenarioStep; index: number; onEdit: (i: number) => void } }) {
  const { step, index, onEdit } = data;
  const { token } = theme.useToken();
  const color = ACTION_COLORS[step.action] || "#1890ff";
  const isTestData = step.value?.includes("{{");

  return (
    <div
      onClick={() => onEdit(index)}
      style={{
        minWidth: 200,
        maxWidth: 280,
        padding: "10px 16px",
        borderRadius: 10,
        border: `2px solid ${color}`,
        // PER-67: theme-token background so node stays readable in dark mode
        background: token.colorBgContainer,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Tag color={color} style={{ margin: 0, fontSize: 11 }}>{ACTION_LABELS[step.action]}</Tag>
        {step.screen_name && (
          <span style={{ fontSize: 10, color: token.colorTextTertiary }}>{step.screen_name}</span>
        )}
      </div>
      <div style={{ fontWeight: 600 }}>{step.element_label || "..."}</div>
      {step.value && (
        <div style={{ fontSize: 11, color: isTestData ? "#eb2f96" : token.colorTextSecondary, marginTop: 2 }}>
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

// ─────────────────────────── Flowchart Editor ────────────────────────────

function FlowchartEditor({
  steps,
  onChange,
  height = 500,
}: {
  steps: ScenarioStep[];
  onChange: (steps: ScenarioStep[]) => void;
  height?: number;
}) {
  const tdataVars = useContext(VarsCtx);
  const { token } = theme.useToken();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();

  const onEdit = useCallback(
    (i: number) => {
      setEditingIndex(i);
      editForm.setFieldsValue(steps[i]);
    },
    [steps, editForm],
  );

  const { initialNodes, initialEdges } = useMemo(() => {
    const ns: Node[] = [
      {
        id: "start",
        type: "startEnd",
        position: { x: 200, y: 0 },
        data: { label: "Начало", color: "#52c41a" },
        draggable: true,
      },
    ];
    const es: Edge[] = [];

    steps.forEach((step, i) => {
      ns.push({
        id: `step-${i}`,
        type: "step",
        position: { x: 160, y: 80 + i * 130 },
        data: { step, index: i, onEdit },
        draggable: true,
      });
      es.push({
        id: `e-${i === 0 ? "start" : `step-${i - 1}`}-step-${i}`,
        source: i === 0 ? "start" : `step-${i - 1}`,
        target: `step-${i}`,
        animated: true,
        style: { stroke: token.colorBorder, strokeWidth: 2 },
      });
    });

    const endY = 80 + steps.length * 130;
    ns.push({
      id: "end",
      type: "startEnd",
      position: { x: 200, y: endY },
      data: { label: "Конец", color: "#ff4d4f" },
      draggable: true,
    });
    if (steps.length > 0) {
      es.push({
        id: `e-step-${steps.length - 1}-end`,
        source: `step-${steps.length - 1}`,
        target: "end",
        animated: true,
        style: { stroke: token.colorBorder, strokeWidth: 2 },
      });
    } else {
      es.push({
        id: "e-start-end",
        source: "start",
        target: "end",
        animated: true,
        style: { stroke: token.colorBorder, strokeWidth: 2 },
      });
    }

    return { initialNodes: ns, initialEdges: es };
  }, [steps, onEdit, token.colorBorder]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
      <div
        style={{
          height,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          // PER-67: theme-aware canvas background
          background: token.colorFillQuaternary,
          position: "relative",
        }}
      >
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
          {/* PER-73: full controls (zoom/fit/lock) + minimap so users
              don't lose orientation in long scenarios. */}
          <Controls />
          <MiniMap pannable zoomable />
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

      <Modal
        open={editingIndex !== null}
        title={editingIndex !== null ? `Шаг ${editingIndex + 1}` : ""}
        onCancel={() => setEditingIndex(null)}
        onOk={handleEditSave}
        okText="Применить"
        cancelText="Отмена"
        width={520}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button danger onClick={handleEditDelete}>Удалить шаг</Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="screen_name"
            label={<LabelWithHint label="Экран" hint={HINTS.screen_name} />}
          >
            <Input placeholder="Login, Profile, Settings..." />
          </Form.Item>
          <Form.Item
            name="action"
            label={<LabelWithHint label="Действие" hint={HINTS.action} />}
          >
            <Select options={ACTION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="element_label"
            label={<LabelWithHint label="Элемент" hint={HINTS.element_label} />}
          >
            <Input placeholder="Кнопка, поле, переключатель..." />
          </Form.Item>
          <Form.Item
            name="value"
            label={<LabelWithHint label="Значение" hint={HINTS.value} />}
          >
            <VarAutocompleteInput variables={tdataVars} placeholder="Текст или {{test_data.key}}" />
          </Form.Item>
          <Form.Item
            name="expected_result"
            label={<LabelWithHint label="Ожидаемый результат" hint={HINTS.expected_result} />}
          >
            <Input placeholder="Что должно произойти" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ─────────────────────────── List page (PER-66) ──────────────────────────

export function AdminScenarios() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspace = useWorkspaceStore((s) => s.current);

  const scenariosQuery = useQuery({
    queryKey: ["scenarios", workspace?.id ?? "none"],
    queryFn: () => listScenarios(workspace?.id),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ScenarioCreate) =>
      createScenario({ ...payload, workspace_id: workspace?.id }),
    onSuccess: (created) => {
      notify.success(t("scenarios.created"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      // PER-66: open the new scenario on its own page
      navigate(`/admin/scenarios/${created.id}`);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t("scenarios.createFailed");
      notify.error(typeof detail === "string" ? detail : JSON.stringify(detail));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateScenario(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
    onError: (err: unknown) => {
      // PER-68: backend returns structured 409s — message is a dict.
      const raw = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "message" in raw
          ? (raw as { message: string }).message
          : t("scenarios.saveFailed");
      notify.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => {
      notify.success(t("scenarios.deleted"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
    onError: (err: unknown) => {
      const raw = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "message" in raw
          ? (raw as { message: string }).message
          : t("scenarios.deleteFailed");
      notify.error(msg);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      title: t("scenarios.newScenarioTitle"),
      steps_json: { steps: [] },
    });
  };

  const handleToggleActive = (scenario: ScenarioRead, active: boolean) => {
    updateMutation.mutate({ id: scenario.id, payload: { is_active: active } });
  };

  const stepsCount = (s: ScenarioRead): number => {
    const steps = (s.steps_json as { steps?: unknown[] })?.steps;
    return Array.isArray(steps) ? steps.length : 0;
  };

  const columns: ColumnsType<ScenarioRead> = [
    {
      title: t("scenarios.columns.title"),
      dataIndex: "title",
      key: "title",
      render: (title: string, record) => (
        <Link to={`/admin/scenarios/${record.id}`}>
          <Typography.Text strong>{title}</Typography.Text>
        </Link>
      ),
    },
    {
      title: "Шагов",
      key: "steps",
      width: 100,
      render: (_, record) => <Tag>{stepsCount(record)}</Tag>,
    },
    {
      title: "Документов БЗ",
      key: "rag",
      width: 130,
      render: (_, record) => {
        const ids = record.rag_document_ids ?? [];
        return ids.length > 0 ? <Tag color="purple">{ids.length}</Tag> : <span style={{ color: "#999" }}>—</span>;
      },
    },
    {
      title: "Создан",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (iso: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatDate(iso)}</Typography.Text>
      ),
    },
    {
      title: t("scenarios.columns.active"),
      key: "is_active",
      width: 110,
      align: "center",
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.is_active}
          onChange={(active) => handleToggleActive(record, active)}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_, record) => (
        // PER-68: don't allow delete of an active scenario.
        <Tooltip title={record.is_active ? "Сначала отключите сценарий" : "Удалить"}>
          <Popconfirm
            title={t("scenarios.deleteConfirm")}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t("common.delete")}
            okButtonProps={{ danger: true }}
            disabled={record.is_active}
          >
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              size="small"
              disabled={record.is_active}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("scenarios.title")}
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          loading={createMutation.isPending}
        >
          {t("scenarios.createScenario")}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => scenariosQuery.refetch()}>
          Обновить
        </Button>
      </Space>

      <Table<ScenarioRead>
        rowKey="id"
        loading={scenariosQuery.isLoading}
        columns={columns}
        dataSource={scenariosQuery.data ?? []}
        pagination={{ pageSize: 20 }}
        size="middle"
      />
    </div>
  );
}

// ─────────────────────────── Edit page (PER-66) ──────────────────────────

export function AdminScenarioEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const workspace = useWorkspaceStore((s) => s.current);

  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [editorMode, setEditorMode] = useState<string>("constructor");
  // PER-69: track unsaved changes for the navigate-away warning
  const [isDirty, setIsDirty] = useState(false);
  const initialStateRef = useRef<string>("");

  const tdataQ = useQuery({
    queryKey: ["test-data", workspace?.id ?? "none"],
    queryFn: () => listTestData(workspace?.id),
  });
  const tdataVars = (tdataQ.data ?? []).map((d) => ({
    key: `test_data.${d.key}`,
    value: d.value,
  }));

  const scenariosQuery = useQuery({
    queryKey: ["scenarios", workspace?.id ?? "none"],
    queryFn: () => listScenarios(workspace?.id),
  });
  const scenario = scenariosQuery.data?.find((s) => s.id === id) ?? null;

  const knowledgeQ = useQuery({
    queryKey: ["knowledge-documents", workspace?.id ?? "none"],
    queryFn: () => listKnowledgeDocuments(workspace?.id),
    staleTime: 60_000,
  });

  // Hydrate form from server when scenario loads
  useEffect(() => {
    if (!scenario) return;
    const loadedSteps = (scenario.steps_json as { steps?: ScenarioStep[] })?.steps ?? [];
    setSteps(loadedSteps);
    const initial = {
      title: scenario.title,
      description: scenario.description ?? "",
      rag_document_ids: scenario.rag_document_ids ?? [],
    };
    form.setFieldsValue(initial);
    initialStateRef.current = JSON.stringify({ ...initial, steps: loadedSteps });
    setIsDirty(false);
  }, [scenario, form]);

  // PER-69: dirty tracking — any field/step change marks dirty
  const handleStepsChange = (next: ScenarioStep[]) => {
    setSteps(next);
    setIsDirty(true);
  };
  const handleFormChange = () => setIsDirty(true);

  // PER-69: warn on navigate-away inside the SPA
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    Modal.confirm({
      title: "Несохранённые изменения",
      content: "Покинуть страницу? Все изменения будут потеряны.",
      okText: "Покинуть",
      okButtonProps: { danger: true },
      cancelText: "Остаться",
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
  }, [blocker]);

  // PER-69: warn on close-tab / reload / native back
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const updateMutation = useMutation({
    mutationFn: ({ payload }: { payload: Record<string, unknown> }) =>
      updateScenario(id!, payload),
    onSuccess: () => {
      notify.success(t("scenarios.saved"));
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setIsDirty(false);
    },
    onError: (err: unknown) => {
      const raw = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "message" in raw
          ? (raw as { message: string }).message
          : t("scenarios.saveFailed");
      notify.error(msg);
    },
  });

  const handleSave = () => {
    if (!id) return;
    form.validateFields().then((values) => {
      const cleanSteps = steps.map((s) => {
        const clean: ScenarioStep = {
          screen_name: s.screen_name,
          action: s.action,
          element_label: s.element_label,
        };
        if (s.value?.trim()) clean.value = s.value.trim();
        if (s.expected_result?.trim()) clean.expected_result = s.expected_result.trim();
        return clean;
      });
      updateMutation.mutate({
        payload: {
          title: values.title,
          description: values.description || undefined,
          steps_json: { steps: cleanSteps },
          rag_document_ids: (values.rag_document_ids ?? []).length
            ? values.rag_document_ids
            : null,
        },
      });
    });
  };

  const handleToggleActive = (active: boolean) => {
    if (!id) return;
    updateMutation.mutate({ payload: { is_active: active } });
  };

  if (!scenario && !scenariosQuery.isLoading) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <Typography.Text type="secondary">Сценарий не найден</Typography.Text>
        <div style={{ marginTop: 16 }}>
          <Link to="/admin/scenarios">
            <Button icon={<ArrowLeftOutlined />}>К списку сценариев</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <VarsCtx.Provider value={tdataVars}>
      {/* Top toolbar */}
      <Space
        style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}
        size="middle"
      >
        <Space>
          <Link to="/admin/scenarios">
            <Button icon={<ArrowLeftOutlined />}>К списку</Button>
          </Link>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {scenario?.title ?? "Загрузка…"}
          </Typography.Title>
          {scenario && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatDate(scenario.created_at)}
            </Typography.Text>
          )}
          {scenario && (
            <Tag color={scenario.is_active ? "green" : undefined}>
              {scenario.is_active ? t("scenarios.statusActive") : t("scenarios.statusInactive")}
            </Tag>
          )}
        </Space>
        <Space>
          {/* PER-68: is_active toggle is shown ONLY for already-saved
              scenarios. The newly-created stub starts inactive on the
              server, the toggle appears once the row exists with id. */}
          {scenario && (
            <Tooltip
              title={
                scenario.is_active
                  ? "Активный сценарий доступен для использования в запусках"
                  : "Неактивный — недоступен для запусков"
              }
            >
              <Switch
                checked={scenario.is_active}
                onChange={handleToggleActive}
                checkedChildren="Активен"
                unCheckedChildren="Неактивен"
                loading={updateMutation.isPending}
              />
            </Tooltip>
          )}
          <Segmented
            value={editorMode}
            onChange={(v) => setEditorMode(v as string)}
            options={[
              { value: "constructor", label: "Конструктор" },
              { value: "flowchart", label: "Блок-схема" },
              { value: "json", label: "JSON" },
            ]}
          />
          <Button
            type="primary"
            onClick={handleSave}
            loading={updateMutation.isPending}
            disabled={!isDirty}
          >
            {t("common.save")}
          </Button>
        </Space>
      </Space>

      <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
        <Form.Item
          name="title"
          label={<LabelWithHint label={t("scenarios.titleLabel")} hint="Короткое название сценария — будет видно в списке и при выборе в New Run." />}
          rules={[{ required: true, message: t("scenarios.titleRequired") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="description"
          label={<LabelWithHint label={t("scenarios.descriptionLabel")} hint="Опциональное описание: что проверяет сценарий, на каком приложении, особые условия." />}
        >
          <Input.TextArea rows={2} />
        </Form.Item>

        {/* PER-72: «Спека» → «Документы базы знаний». PER-71: multi-select
            with tag display is the AntD default for mode="multiple". */}
        <Form.Item
          name="rag_document_ids"
          label={<LabelWithHint label="Документы базы знаний" hint={HINTS.rag_documents} />}
          extra="Если не выбрать ни одного — RAG-сверка идёт по всему корпусу пространства."
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="Выберите документы (опционально)"
            loading={knowledgeQ.isLoading}
            options={(knowledgeQ.data ?? []).map((d) => ({ value: d.id, label: d.title }))}
            optionFilterProp="label"
          />
        </Form.Item>

        {editorMode === "json" ? (
          <Form.Item label="JSON">
            {/* PER-74: Monaco-backed editor with format + {{test_data.*}} autocomplete. */}
            <JsonScenarioEditor
              value={JSON.stringify({ steps }, null, 2)}
              onChange={(s) => {
                try {
                  const p = JSON.parse(s);
                  handleStepsChange(p.steps ?? []);
                } catch {
                  /* ignore while typing */
                }
              }}
              variables={tdataVars}
              height={600}
            />
          </Form.Item>
        ) : editorMode === "flowchart" ? (
          <Form.Item label={`Блок-схема (${steps.length} шагов)`}>
            {/* PER-66: bigger canvas now that the editor has the whole page */}
            <FlowchartEditor steps={steps} onChange={handleStepsChange} height={640} />
          </Form.Item>
        ) : (
          <Form.Item label={`Шаги (${steps.length})`}>
            <StepEditor steps={steps} onChange={handleStepsChange} />
          </Form.Item>
        )}
      </Form>
    </VarsCtx.Provider>
  );
}
