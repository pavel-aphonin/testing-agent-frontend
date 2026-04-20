import { CloudDownloadOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/utils/notify";

import {
  createModel,
  deleteModel,
  listAllModels,
  updateModel,
} from "@/api/models";
import { BrowseHfModal } from "@/components/BrowseHfModal";
import type { LLMModelAdmin, LLMModelCreate, LLMModelUpdate } from "@/types";

function formatBytes(n: number): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function AdminModels() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [editing, setEditing] = useState<LLMModelAdmin | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-models"],
    queryFn: listAllModels,
  });

  const createMutation = useMutation({
    mutationFn: createModel,
    onSuccess: () => {
      notify.success(t("common.create"));
      queryClient.invalidateQueries({ queryKey: ["admin-models"] });
      queryClient.invalidateQueries({ queryKey: ["public-models"] });
      setCreateOpen(false);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("common.error");
      notify.error(detail);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LLMModelUpdate }) =>
      updateModel(id, payload),
    onSuccess: () => {
      notify.success(t("common.save"));
      queryClient.invalidateQueries({ queryKey: ["admin-models"] });
      queryClient.invalidateQueries({ queryKey: ["public-models"] });
      setEditing(null);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("common.error");
      notify.error(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => {
      notify.success(t("adminModels.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-models"] });
      queryClient.invalidateQueries({ queryKey: ["public-models"] });
    },
    onError: () => notify.error(t("adminModels.deleteFailed")),
  });

  const columns: DataTableColumn<LLMModelAdmin>[] = [
    {
      title: t("adminModels.columns.name"),
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t("adminModels.columns.family"),
      dataIndex: "family",
      key: "family",
      width: 120,
      sorter: (a, b) => a.family.localeCompare(b.family),
      render: (f: unknown) => <Tag>{f as string}</Tag>,
    },
    {
      title: t("adminModels.columns.quantization"),
      dataIndex: "quantization",
      key: "q",
      width: 110,
      sorter: (a, b) => a.quantization.localeCompare(b.quantization),
    },
    {
      title: t("adminModels.columns.context"),
      dataIndex: "context_length",
      key: "ctx",
      width: 110,
      sorter: (a, b) => a.context_length - b.context_length,
      render: (n: unknown) => `${(n as number).toLocaleString()} tok`,
    },
    {
      title: t("adminModels.columns.size"),
      dataIndex: "size_bytes",
      key: "size",
      width: 100,
      sorter: (a, b) => a.size_bytes - b.size_bytes,
      render: (v: unknown) => formatBytes(v as number),
    },
    {
      title: t("adminModels.columns.active"),
      dataIndex: "is_active",
      key: "active",
      width: 90,
      filters: [
        { text: t("common.yes"), value: true as any },
        { text: t("common.no"), value: false as any },
      ],
      onFilter: (v, r) => r.is_active === v,
      render: (b: unknown) =>
        b ? <Tag color="green">{t("common.yes")}</Tag> : <Tag color="default">{t("common.no")}</Tag>,
    },
    {
      title: t("adminModels.columns.bench"),
      dataIndex: "benchmark_tps",
      key: "tps",
      width: 110,
      defaultVisible: false,
      sorter: (a, b) => (a.benchmark_tps ?? 0) - (b.benchmark_tps ?? 0),
      render: (n: unknown) => (n != null ? `${(n as number).toFixed(1)}` : "—"),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 160,
      toggleable: false,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(record)}
          >
            {t("common.edit")}
          </Button>
          <Popconfirm
            title={t("adminModels.deleteConfirm")}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("adminModels.title")}
        </Typography.Title>
        <Space>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={() => setBrowseOpen(true)}
          >
            {t("adminModels.browseHf")}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            {t("adminModels.registerModel")}
          </Button>
        </Space>
      </Space>

      <DataTable<LLMModelAdmin>
        tableKey="models"
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading || isFetching}
        pagination={{ pageSize: 20 }}
        scroll={{ x: "max-content" }}
      />

      <CreateModelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        loading={createMutation.isPending}
      />

      <BrowseHfModal open={browseOpen} onClose={() => setBrowseOpen(false)} />

      <EditModelModal
        model={editing}
        onClose={() => setEditing(null)}
        onSubmit={(payload) =>
          editing && updateMutation.mutate({ id: editing.id, payload })
        }
        loading={updateMutation.isPending}
      />
    </>
  );
}

// ---------------------------------------------------------- create modal

function CreateModelModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LLMModelCreate) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<LLMModelCreate>();
  return (
    <Modal
      title={t("adminModels.createModal.title")}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t("adminModels.createModal.register")}
      cancelText={t("common.cancel")}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        validateTrigger="onSubmit"
        initialValues={{
          family: "qwen-3.5",
          quantization: "Q4_K_XL",
          context_length: 32768,
          size_bytes: 0,
          supports_vision: false,
          supports_tool_use: true,
          is_active: true,
          default_temperature: 0.7,
          default_top_p: 0.9,
        }}
      >
        <Form.Item
          name="name"
          label={t("adminModels.createModal.nameLabel")}
          rules={[{ required: true, message: t("adminModels.createModal.nameRequired") }]}
        >
          <Input placeholder={t("adminModels.createModal.namePlaceholder")} />
        </Form.Item>

        <Form.Item
          name="family"
          label={t("adminModels.createModal.familyLabel")}
          rules={[{ required: true }]}
          extra={t("adminModels.createModal.familyHelp")}
        >
          <Input placeholder={t("adminModels.createModal.familyPlaceholder")} />
        </Form.Item>

        <Form.Item
          name="gguf_path"
          label={t("adminModels.createModal.ggufPathLabel")}
          rules={[{ required: true }]}
        >
          <Input placeholder={t("adminModels.createModal.ggufPathPlaceholder")} />
        </Form.Item>

        <Form.Item name="mmproj_path" label={t("adminModels.createModal.mmprojLabel")}>
          <Input placeholder={t("adminModels.createModal.mmprojPlaceholder")} />
        </Form.Item>

        <Space style={{ width: "100%" }}>
          <Form.Item
            name="quantization"
            label={t("adminModels.createModal.quantLabel")}
            rules={[{ required: true }]}
          >
            <Input placeholder={t("adminModels.createModal.quantPlaceholder")} />
          </Form.Item>
          <Form.Item name="context_length" label={t("adminModels.createModal.contextLabel")}>
            <InputNumber min={128} max={1_000_000} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="size_bytes" label={t("adminModels.createModal.sizeLabel")}>
            <InputNumber min={0} style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Space>
          <Form.Item name="supports_tool_use" label={t("adminModels.createModal.toolUse")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="supports_vision" label={t("adminModels.createModal.vision")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label={t("adminModels.createModal.active")} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>

        <Form.Item name="description" label={t("adminModels.createModal.descriptionLabel")}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ------------------------------------------------------------ edit modal

function EditModelModal({
  model,
  onClose,
  onSubmit,
  loading,
}: {
  model: LLMModelAdmin | null;
  onClose: () => void;
  onSubmit: (payload: LLMModelUpdate) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<LLMModelUpdate>();

  return (
    <Modal
      title={model ? t("adminModels.editModal.title", { name: model.name }) : ""}
      open={model !== null}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={loading}
      destroyOnHidden
      forceRender
    >
      {model && (
        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          initialValues={{
            description: model.description ?? "",
            is_active: model.is_active,
            default_temperature: model.default_temperature,
            default_top_p: model.default_top_p,
            benchmark_tps: model.benchmark_tps ?? undefined,
            benchmark_ttft_ms: model.benchmark_ttft_ms ?? undefined,
            notes: model.notes ?? "",
          }}
        >
          <Form.Item name="description" label={t("adminModels.editModal.descriptionLabel")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label={t("adminModels.editModal.active")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Form.Item name="default_temperature" label={t("adminModels.editModal.temperature")}>
              <InputNumber min={0} max={2} step={0.05} />
            </Form.Item>
            <Form.Item name="default_top_p" label={t("adminModels.editModal.topP")}>
              <InputNumber min={0} max={1} step={0.05} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="benchmark_tps" label={t("adminModels.editModal.benchTps")}>
              <InputNumber min={0} step={0.1} />
            </Form.Item>
            <Form.Item name="benchmark_ttft_ms" label={t("adminModels.editModal.ttft")}>
              <InputNumber min={0} step={1} />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label={t("adminModels.editModal.notesLabel")}>
            <Input.TextArea rows={2} placeholder={t("adminModels.editModal.notesPlaceholder")} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
