import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Popconfirm, Space, Tag, Tooltip, Typography, Upload } from "antd";
import { Link } from "react-router-dom";

import {
  deletePackage,
  myPackages,
  submitForReview,
  uploadBundle,
} from "@/api/apps";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useAuthStore } from "@/store/auth";
import type { AppPackageRead } from "@/types";
import { notify } from "@/utils/notify";

const STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: "default", icon: <EditOutlined />, label: "Черновик" },
  pending: { color: "blue", icon: <ClockCircleOutlined />, label: "На модерации" },
  approved: { color: "green", icon: <CheckCircleOutlined />, label: "Опубликовано" },
  rejected: { color: "red", icon: <CloseCircleOutlined />, label: "Отклонено" },
};

/** Tab rendered inside Profile: "Мои приложения". */
export function ProfileMyApps() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  // Same gate as AppsStore — admins get it via the admin role.
  const canUpload = Boolean(me && (me.permissions ?? []).includes("apps.upload"));

  const mineQ = useQuery({
    queryKey: ["apps-mine"],
    queryFn: myPackages,
  });

  const uploadM = useMutation({
    mutationFn: (file: File) => uploadBundle(file, { submit_for_review: true }),
    onSuccess: (pkg) => {
      notify.success(`Загружено: ${pkg.name}`);
      qc.invalidateQueries({ queryKey: ["apps-mine"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка загрузки"),
  });

  const submitM = useMutation({
    mutationFn: (id: string) => submitForReview(id),
    onSuccess: () => {
      notify.success("Отправлено на модерацию");
      qc.invalidateQueries({ queryKey: ["apps-mine"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["apps-mine"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const columns: DataTableColumn<AppPackageRead>[] = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: unknown, rec) => (
        <Link to={`/apps/${rec.id}`}>
          <Typography.Text strong>{v as string}</Typography.Text>
        </Link>
      ),
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 180,
      render: (v: unknown) => <Typography.Text code>{v as string}</Typography.Text>,
    },
    {
      title: "Версия",
      dataIndex: "latest_version",
      key: "version",
      width: 100,
    },
    {
      title: "Статус",
      dataIndex: "approval_status",
      key: "status",
      width: 160,
      filters: Object.entries(STATUS_META).map(([v, m]) => ({ text: m.label, value: v })),
      onFilter: (v, r) => r.approval_status === v,
      render: (v: unknown) => {
        const meta = STATUS_META[v as string] ?? STATUS_META.draft;
        return (
          <Tag color={meta.color} icon={meta.icon}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: "Установок",
      dataIndex: "install_count",
      key: "installs",
      width: 110,
      sorter: (a, b) => a.install_count - b.install_count,
    },
    {
      title: "Доступ",
      dataIndex: "is_public",
      key: "is_public",
      width: 120,
      render: (v: unknown) => (v ? <Tag color="blue">Публичное</Tag> : <Tag color="gold">Приватное</Tag>),
    },
    {
      title: "Действия",
      key: "actions",
      width: 240,
      toggleable: false,
      render: (_: unknown, rec) => (
        <Space size="small">
          {(rec.approval_status === "draft" || rec.approval_status === "rejected") && (
            <Tooltip title="Отправить на модерацию">
              <Button
                size="small"
                icon={<RocketOutlined />}
                onClick={() => submitM.mutate(rec.id)}
              >
                На модерацию
              </Button>
            </Tooltip>
          )}
          <Popconfirm
            title="Удалить приложение?"
            description="Вместе со всеми версиями."
            onConfirm={() => delM.mutate(rec.id)}
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
    <>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          Загруженные мной приложения
        </Typography.Title>
        {canUpload && (
          <Upload
            accept=".zip"
            showUploadList={false}
            beforeUpload={(file) => {
              uploadM.mutate(file);
              return false;
            }}
          >
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploadM.isPending}>
              Загрузить новое приложение
            </Button>
          </Upload>
        )}
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="ZIP-архив должен содержать manifest.json, папку frontend/ (UI), logic/ (серверная часть), logo.png и README.md"
      />

      <DataTable<AppPackageRead>
        tableKey="apps.mine"
        rowKey="id"
        columns={columns}
        dataSource={mineQ.data}
        loading={mineQ.isLoading}
        pagination={{ pageSize: 20 }}
      />
    </>
  );
}
