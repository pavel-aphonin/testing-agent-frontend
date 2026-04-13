import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/utils/notify";

import {
  createTestData,
  deleteTestData,
  listTestData,
  updateTestData,
} from "@/api/testData";
import type { TestDataCreate, TestDataRead, TestDataUpdate } from "@/types";

const CATEGORIES = ["auth", "payment", "personal", "general"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  auth: "blue",
  payment: "green",
  personal: "orange",
  general: "default",
};

const MASKED_KEYS = ["password", "пароль", "secret", "token", "pin"];

function isMaskedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return MASKED_KEYS.some((k) => lower.includes(k));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("ru-RU", { hour12: false });
  return `${day}.${month}.${year} ${time}`;
}

export function TestData() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const dataQuery = useQuery({
    queryKey: ["test-data"],
    queryFn: listTestData,
  });

  const createMutation = useMutation({
    mutationFn: (payload: TestDataCreate) => createTestData(payload),
    onSuccess: () => {
      notify.success(t("testData.created"));
      queryClient.invalidateQueries({ queryKey: ["test-data"] });
      closeModal();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("testData.createFailed");
      notify.error(detail);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TestDataUpdate }) =>
      updateTestData(id, payload),
    onSuccess: () => {
      notify.success(t("testData.saved"));
      queryClient.invalidateQueries({ queryKey: ["test-data"] });
      closeModal();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("testData.saveFailed");
      notify.error(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTestData,
    onSuccess: () => {
      notify.success(t("testData.deleted"));
      queryClient.invalidateQueries({ queryKey: ["test-data"] });
    },
    onError: () => {
      notify.error(t("testData.deleteFailed"));
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ category: "general" });
    setModalOpen(true);
  };

  const openEdit = (record: TestDataRead) => {
    setEditingId(record.id);
    form.setFieldsValue({
      key: record.key,
      value: record.value,
      category: record.category,
      description: record.description ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingId) {
        updateMutation.mutate({ id: editingId, payload: values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredData = filterCategory
    ? dataQuery.data?.filter((d) => d.category === filterCategory)
    : dataQuery.data;

  const columns: ColumnsType<TestDataRead> = [
    {
      title: t("testData.columns.key"),
      dataIndex: "key",
      key: "key",
      width: 200,
      render: (key: string) => (
        <Typography.Text strong code>
          {key}
        </Typography.Text>
      ),
    },
    {
      title: t("testData.columns.value"),
      dataIndex: "value",
      key: "value",
      render: (value: string, record: TestDataRead) => {
        const masked = isMaskedKey(record.key);
        const revealed = revealedIds.has(record.id);

        if (masked && !revealed) {
          return (
            <Space>
              <Typography.Text type="secondary">{"********"}</Typography.Text>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => toggleReveal(record.id)}
              />
            </Space>
          );
        }

        return (
          <Space>
            <Typography.Text>{value}</Typography.Text>
            {masked && (
              <Button
                type="text"
                size="small"
                icon={<EyeInvisibleOutlined />}
                onClick={() => toggleReveal(record.id)}
              />
            )}
          </Space>
        );
      },
    },
    {
      title: t("testData.columns.category"),
      dataIndex: "category",
      key: "category",
      width: 140,
      render: (category: string) => (
        <Tag color={CATEGORY_COLORS[category] ?? "default"}>
          {t(`testData.categories.${category}`, { defaultValue: category })}
        </Tag>
      ),
    },
    {
      title: t("testData.columns.description"),
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc: string | null) =>
        desc ? (
          <Typography.Text type="secondary">{desc}</Typography.Text>
        ) : (
          <Typography.Text type="secondary" italic>
            --
          </Typography.Text>
        ),
    },
    {
      title: t("testData.columns.created"),
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (iso: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(iso)}
        </Typography.Text>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title={t("testData.deleteConfirm")}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t("common.delete")}
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("testData.title")}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t("testData.subtitle")}
        </Typography.Text>
      </Space>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Select
          allowClear
          placeholder={t("testData.filterCategory")}
          style={{ width: 240 }}
          value={filterCategory}
          onChange={(v) => setFilterCategory(v ?? null)}
          options={CATEGORIES.map((c) => ({
            value: c,
            label: t(`testData.categories.${c}`),
          }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          {t("testData.add")}
        </Button>
      </div>

      <Table<TestDataRead>
        rowKey="id"
        loading={dataQuery.isLoading}
        columns={columns}
        dataSource={filteredData ?? []}
        pagination={{ pageSize: 20 }}
        size="middle"
      />

      <Modal
        title={editingId ? t("testData.editTitle") : t("testData.addTitle")}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingId ? t("common.save") : t("common.create")}
        cancelText={t("common.cancel")}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="key"
            label={t("testData.keyLabel")}
            rules={[{ required: true, message: t("testData.keyRequired") }]}
          >
            <Input placeholder={t("testData.keyPlaceholder")} />
          </Form.Item>

          <Form.Item
            name="value"
            label={t("testData.valueLabel")}
            rules={[{ required: true, message: t("testData.valueRequired") }]}
          >
            <Input placeholder={t("testData.valuePlaceholder")} />
          </Form.Item>

          <Form.Item
            name="category"
            label={t("testData.categoryLabel")}
          >
            <Select
              options={CATEGORIES.map((c) => ({
                value: c,
                label: t(`testData.categories.${c}`),
              }))}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t("testData.descriptionLabel")}
          >
            <Input.TextArea rows={2} placeholder={t("testData.descriptionPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
