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
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
// PER-82: react-flow direct usage moved into GraphEditor — this page
// only reads the v2 graph state now.

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
import { GraphEditor } from "@/components/scenario/graph/GraphEditor";
import {
  emptyGraph,
  normalizeGraph,
  type ScenarioGraphV2,
  type ActionNodeData,
} from "@/components/scenario/graph/types";
import { validateGraph } from "@/components/scenario/graph/validate";
import { useWorkspaceStore } from "@/store/workspace";
import type { ScenarioCreate, ScenarioRead } from "@/types";

// ─────────────────────────── shared types + helpers ───────────────────────

const VarsCtx = createContext<{ key: string; value?: string }[]>([]);

interface ScenarioStep {
  screen_name: string;
  // PER-82: keep this aligned with ActionVerb in the graph types so
  // round-trips between linear and graph views don't lose actions.
  action: "tap" | "input" | "swipe" | "wait" | "assert" | "back";
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
    // PER-82: post the empty v2 graph (start + end). Backend would
    // normalize either shape, but sending v2 saves a redundant
    // round-trip and keeps the wire format consistent end-to-end.
    createMutation.mutate({
      title: t("scenarios.newScenarioTitle"),
      steps_json: emptyGraph() as unknown as Record<string, unknown>,
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
        return ids.length > 0 ? <Tag color="purple">{ids.length}</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const workspace = useWorkspaceStore((s) => s.current);

  // PER-82: state model is now the v2 graph. The legacy ``steps``
  // array is derived for the Constructor and JSON tabs when (and
  // only when) the graph is purely linear; non-linear graphs disable
  // those tabs to avoid data loss on round-trip.
  const [graph, setGraph] = useState<ScenarioGraphV2>(() => emptyGraph());
  const [editorMode, setEditorMode] = useState<string>("flowchart");
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

  // Hydrate form from server when scenario loads. PER-82: backend
  // returns v2; ``normalizeGraph`` is also robust to v1 just in case.
  useEffect(() => {
    if (!scenario) return;
    const loadedGraph = normalizeGraph(scenario.steps_json);
    setGraph(loadedGraph);
    const initial = {
      title: scenario.title,
      description: scenario.description ?? "",
      rag_document_ids: scenario.rag_document_ids ?? [],
    };
    form.setFieldsValue(initial);
    initialStateRef.current = JSON.stringify({ ...initial, graph: loadedGraph });
    setIsDirty(false);
  }, [scenario, form]);

  // PER-69 + PER-82: dirty tracking on graph or form changes.
  const handleGraphChange = (next: ScenarioGraphV2) => {
    setGraph(next);
    setIsDirty(true);
  };
  const handleFormChange = () => setIsDirty(true);

  // PER-84: surface validation status to the toolbar so we can disable
  // Save while the graph has errors. Cheap: same memo the editor runs.
  const graphIssues = useMemo(() => validateGraph(graph), [graph]);
  const graphErrors = useMemo(
    () => graphIssues.filter((i) => i.severity === "error"),
    [graphIssues],
  );

  // Derive a linear ``steps`` view of the graph for the Constructor /
  // JSON tabs. Returns null if the graph isn't a simple chain
  // start → action … → end (i.e. it has decisions, loops, or
  // branching) — those tabs are then hidden / disabled to avoid
  // round-trip data loss.
  const linearSteps = useMemo<ScenarioStep[] | null>(() => {
    const startNode = graph.nodes.find((n) => n.type === "start");
    if (!startNode) return null;
    const outgoing = new Map<string, string[]>();
    for (const e of graph.edges) {
      const list = outgoing.get(e.source) ?? [];
      list.push(e.target);
      outgoing.set(e.source, list);
    }
    // Each non-end node must have exactly one outgoing edge.
    for (const n of graph.nodes) {
      if (n.type === "end") continue;
      if ((outgoing.get(n.id) ?? []).length !== 1) return null;
    }
    // All non start/end nodes must be action — anything else means
    // the graph carries semantics the linear views can't represent.
    for (const n of graph.nodes) {
      if (n.type !== "start" && n.type !== "end" && n.type !== "action") {
        return null;
      }
    }
    const result: ScenarioStep[] = [];
    let cur: string | undefined = startNode.id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const node = graph.nodes.find((n) => n.id === cur);
      if (!node) return null;
      if (node.type === "end") break;
      if (node.type === "action") {
        const d = (node.data ?? {}) as ActionNodeData;
        result.push({
          screen_name: d.screen_name ?? "",
          action: d.action ?? "tap",
          element_label: d.element_label ?? "",
          value: d.value,
          expected_result: d.expected_result,
        });
      }
      cur = (outgoing.get(node.id) ?? [])[0];
    }
    return result;
  }, [graph]);

  /** Replace the graph's action nodes with a fresh linear chain
   *  derived from ``steps`` — used by the Constructor and JSON tabs.
   *  Preserves start/end ids so positions persist across edits. */
  const replaceGraphFromLinear = (steps: ScenarioStep[]) => {
    const nodes: ScenarioGraphV2["nodes"] = [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: ScenarioGraphV2["edges"] = [];
    let prev = "start";
    steps.forEach((step, idx) => {
      const id = `n${idx}`;
      nodes.push({
        id,
        type: "action",
        position: { x: 0, y: (idx + 1) * 120 },
        data: { ...step },
      });
      edges.push({
        id: `e_${prev}_${id}`,
        source: prev,
        target: id,
        data: {},
      });
      prev = id;
    });
    nodes.push({
      id: "end",
      type: "end",
      position: { x: 0, y: (steps.length + 1) * 120 },
      data: {},
    });
    edges.push({
      id: `e_${prev}_end`,
      source: prev,
      target: "end",
      data: {},
    });
    handleGraphChange({ version: 2, nodes, edges });
  };

  // PER-69: in-SPA navigate-away warning. We can't use react-router's
  // `useBlocker` here because the app is mounted via the legacy
  // <BrowserRouter> (not a data router). Instead we expose a helper
  // that the back/cancel buttons inside this page call before
  // navigating away. The native close-tab/reload path is handled by
  // the `beforeunload` listener below.
  const guardNavigate = (to: string) => {
    if (!isDirty) {
      navigate(to);
      return;
    }
    Modal.confirm({
      title: "Несохранённые изменения",
      content: "Покинуть страницу? Все изменения будут потеряны.",
      okText: "Покинуть",
      okButtonProps: { danger: true },
      cancelText: "Остаться",
      onOk: () => navigate(to),
    });
  };

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
      // PER-82: persist the v2 graph as-is. Backend re-validates and
      // refuses anything malformed (e.g. multiple start nodes) with a
      // 400 the mutation's onError already surfaces.
      updateMutation.mutate({
        payload: {
          title: values.title,
          description: values.description || undefined,
          steps_json: graph as unknown as Record<string, unknown>,
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
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => guardNavigate("/admin/scenarios")}
          >
            К списку
          </Button>
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
          <Tooltip
            title={
              graphErrors.length > 0
                ? `Граф содержит ${graphErrors.length} ошибк${
                    graphErrors.length === 1 ? "у" : "и"
                  } — исправьте, чтобы сохранить`
                : ""
            }
          >
            <Button
              type="primary"
              onClick={handleSave}
              loading={updateMutation.isPending}
              disabled={!isDirty || graphErrors.length > 0}
            >
              {t("common.save")}
            </Button>
          </Tooltip>
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
            {/* PER-82: edit the full v2 graph as JSON. Linear-only views
                lost too much data; the worker now needs the graph
                shape end-to-end. */}
            <JsonScenarioEditor
              value={JSON.stringify(graph, null, 2)}
              onChange={(s) => {
                try {
                  const parsed = JSON.parse(s);
                  if (
                    parsed &&
                    Array.isArray(parsed.nodes) &&
                    Array.isArray(parsed.edges)
                  ) {
                    handleGraphChange({
                      version: 2,
                      nodes: parsed.nodes,
                      edges: parsed.edges,
                    });
                  }
                } catch {
                  /* ignore while typing */
                }
              }}
              variables={tdataVars}
              height={600}
            />
          </Form.Item>
        ) : editorMode === "flowchart" ? (
          <Form.Item
            label={`Блок-схема (${graph.nodes.filter((n) => n.type === "action").length} действий)`}
          >
            <GraphEditor
              value={graph}
              onChange={handleGraphChange}
              variables={tdataVars}
              allScenarios={(scenariosQuery.data ?? []).map((s) => ({
                id: s.id,
                title: s.title,
              }))}
              currentScenarioId={id}
              workspaceId={workspace?.id ?? null}
              height={640}
            />
          </Form.Item>
        ) : (
          // Constructor tab is a flat list of action steps. Disabled
          // when the graph has branching/loops because serialising
          // back into a linear chain would silently drop those non-
          // linear pieces.
          linearSteps === null ? (
            <Form.Item label="Шаги">
              <Typography.Paragraph type="warning">
                Этот сценарий содержит ветвления, циклы или другие нелинейные
                элементы. Конструктор работает только с линейными цепочками —
                откройте режим «Блок-схема».
              </Typography.Paragraph>
            </Form.Item>
          ) : (
            <Form.Item label={`Шаги (${linearSteps.length})`}>
              <StepEditor
                steps={linearSteps}
                onChange={(next) => replaceGraphFromLinear(next)}
              />
            </Form.Item>
          )
        )}
      </Form>
    </VarsCtx.Provider>
  );
}
