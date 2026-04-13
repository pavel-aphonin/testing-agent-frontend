import {
  BarChartOutlined,
  EyeOutlined,
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
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { notify } from "@/utils/notify";

import { deleteRun, listRuns } from "@/api/runs";
import { NewRunModal } from "@/components/NewRunModal";
import { useAuthStore } from "@/store/auth";
import type { Run, RunStatus } from "@/types";

const STATUS_COLOR: Record<RunStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function Runs() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["runs"],
    queryFn: listRuns,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => {
      notify.success(t("runs.deleted"));
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("runs.deleteFailed");
      notify.error(detail);
    },
  });

  const canCreate = user?.role === "tester" || user?.role === "admin";
  const canDelete = canCreate;

  const columns: ColumnsType<Run> = [
    {
      title: t("runs.columns.bundleId"),
      dataIndex: "bundle_id",
      key: "bundle_id",
      ellipsis: true,
    },
    {
      title: t("runs.columns.mode"),
      dataIndex: "mode",
      key: "mode",
      width: 100,
    },
    {
      title: t("runs.columns.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: RunStatus) => (
        <Tag color={STATUS_COLOR[status]}>{t(`runStatus.${status}`)}</Tag>
      ),
    },
    {
      title: t("newRunModal.maxSteps"),
      dataIndex: "max_steps",
      key: "max_steps",
      width: 90,
    },
    {
      title: t("common.created"),
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: formatDate,
    },
    {
      title: t("runs.columns.started"),
      dataIndex: "finished_at",
      key: "finished_at",
      width: 180,
      render: formatDate,
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 280,
      render: (_: unknown, record: Run) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/runs/${record.id}/progress`)}
          >
            {t("runs.viewLive")}
          </Button>
          <Button
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/runs/${record.id}/results`)}
            disabled={record.status === "pending"}
          >
            {t("runs.viewResults")}
          </Button>
          {canDelete && (
            <Popconfirm
              title={t("runs.deleteConfirm")}
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small">
                {t("common.delete")}
              </Button>
            </Popconfirm>
          )}
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
          {t("runs.title")}
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["runs"] })
            }
            loading={isFetching && !isLoading}
          >
            {t("common.refresh")}
          </Button>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              {t("runs.newRun")}
            </Button>
          )}
        </Space>
      </Space>

      <Table<Run>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: "max-content" }}
      />

      <NewRunModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
