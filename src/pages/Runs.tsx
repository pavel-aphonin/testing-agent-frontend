import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
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
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

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
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["runs"],
    queryFn: listRuns,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => {
      message.success("Run deleted");
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to delete run";
      message.error(detail);
    },
  });

  const canCreate = user?.role === "tester" || user?.role === "admin";
  const canDelete = canCreate;

  const columns: ColumnsType<Run> = [
    {
      title: "Bundle",
      dataIndex: "bundle_id",
      key: "bundle_id",
      ellipsis: true,
    },
    {
      title: "Mode",
      dataIndex: "mode",
      key: "mode",
      width: 100,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: RunStatus) => (
        <Tag color={STATUS_COLOR[status]}>{status}</Tag>
      ),
    },
    {
      title: "Steps",
      dataIndex: "max_steps",
      key: "max_steps",
      width: 90,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: formatDate,
    },
    {
      title: "Finished",
      dataIndex: "finished_at",
      key: "finished_at",
      width: 180,
      render: formatDate,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: Run) =>
        canDelete ? (
          <Popconfirm
            title="Delete this run?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small">
              Delete
            </Button>
          </Popconfirm>
        ) : null,
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
          Runs
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["runs"] })
            }
            loading={isFetching && !isLoading}
          >
            Refresh
          </Button>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              New run
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
      />

      <NewRunModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
