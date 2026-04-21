import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Space, Tabs, Tag, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  adminAllPackages,
  adminPendingPackages,
  approveOrReject,
  deletePackage,
} from "@/api/apps";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import type { AppPackageRead } from "@/types";
import { notify } from "@/utils/notify";

const STATUS_COLOR: Record<string, string> = {
  draft: "default",
  pending: "blue",
  approved: "green",
  rejected: "red",
};

export function AdminApps() {
  const [tab, setTab] = useState("pending");
  const qc = useQueryClient();
  const nav = useNavigate();
  const [rejectFor, setRejectFor] = useState<AppPackageRead | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingQ = useQuery({
    queryKey: ["apps-admin-pending"],
    queryFn: adminPendingPackages,
  });
  const allQ = useQuery({
    queryKey: ["apps-admin-all"],
    queryFn: adminAllPackages,
    enabled: tab === "all",
  });

  const decideM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { approved: boolean; rejection_reason?: string } }) =>
      approveOrReject(id, payload),
    onSuccess: (pkg) => {
      notify.success(pkg.approval_status === "approved" ? "Одобрено" : "Отклонено");
      qc.invalidateQueries({ queryKey: ["apps-admin-pending"] });
      qc.invalidateQueries({ queryKey: ["apps-admin-all"] });
      qc.invalidateQueries({ queryKey: ["apps-store"] });
      setRejectFor(null);
      setRejectReason("");
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["apps-admin-all"] });
      qc.invalidateQueries({ queryKey: ["apps-admin-pending"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  function makeColumns(showApproveActions: boolean): DataTableColumn<AppPackageRead>[] {
    return [
      {
        title: "Название",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (v: unknown, rec) => (
          <Space>
            <Typography.Text strong>{v as string}</Typography.Text>
            <Typography.Text code style={{ fontSize: 11 }}>
              {rec.code}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Автор",
        dataIndex: "author",
        key: "author",
        width: 160,
        sorter: (a, b) => (a.author ?? "").localeCompare(b.author ?? ""),
      },
      {
        title: "Версия",
        dataIndex: "latest_version",
        key: "latest_version",
        width: 100,
      },
      {
        title: "Категория",
        dataIndex: "category",
        key: "category",
        width: 130,
        filters: [
          { text: "Интеграции", value: "integration" },
          { text: "Автоматизация", value: "automation" },
          { text: "Визуализация", value: "visualization" },
          { text: "Утилиты", value: "utility" },
        ],
        onFilter: (v, r) => r.category === v,
      },
      {
        title: "Тип",
        dataIndex: "is_public",
        key: "is_public",
        width: 110,
        filters: [
          { text: "Публичное", value: true as any },
          { text: "Приватное", value: false as any },
        ],
        onFilter: (v, r) => r.is_public === v,
        render: (v: unknown) => (v ? <Tag color="blue">Публичное</Tag> : <Tag color="gold">Приватное</Tag>),
      },
      {
        title: "Статус",
        dataIndex: "approval_status",
        key: "status",
        width: 120,
        filters: [
          { text: "Draft", value: "draft" },
          { text: "Pending", value: "pending" },
          { text: "Approved", value: "approved" },
          { text: "Rejected", value: "rejected" },
        ],
        onFilter: (v, r) => r.approval_status === v,
        render: (v: unknown) => (
          <Tag color={STATUS_COLOR[v as string] ?? "default"}>{v as string}</Tag>
        ),
      },
      {
        title: "Установок",
        dataIndex: "install_count",
        key: "installs",
        width: 110,
        defaultVisible: false,
        sorter: (a, b) => a.install_count - b.install_count,
      },
      {
        title: "Действия",
        key: "actions",
        width: 200,
        toggleable: false,
        render: (_: unknown, rec: AppPackageRead) => (
          <Space size="small">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => nav(`/apps/${rec.id}`)}
            />
            {showApproveActions && rec.approval_status === "pending" && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => decideM.mutate({ id: rec.id, payload: { approved: true } })}
                  loading={decideM.isPending}
                />
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejectFor(rec)}
                />
              </>
            )}
            {!showApproveActions && (
              <Button
                size="small"
                danger
                onClick={() => {
                  Modal.confirm({
                    title: `Удалить «${rec.name}»?`,
                    content: "Это действие необратимо.",
                    okText: "Удалить",
                    cancelText: "Отмена",
                    okButtonProps: { danger: true },
                    onOk: () => delM.mutate(rec.id),
                  });
                }}
              >
                Удалить
              </Button>
            )}
          </Space>
        ),
      },
    ];
  }

  return (
    <>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        Управление приложениями
      </Typography.Title>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "pending",
            label: (
              <span>
                На модерации{" "}
                {(pendingQ.data?.length ?? 0) > 0 && (
                  <Tag color="red" style={{ marginLeft: 4 }}>
                    {pendingQ.data!.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <DataTable<AppPackageRead>
                tableKey="apps.admin.pending"
                rowKey="id"
                columns={makeColumns(true)}
                dataSource={pendingQ.data}
                loading={pendingQ.isLoading}
                pagination={false}
              />
            ),
          },
          {
            key: "all",
            label: "Все приложения",
            children: (
              <DataTable<AppPackageRead>
                tableKey="apps.admin.all"
                rowKey="id"
                columns={makeColumns(false)}
                dataSource={allQ.data}
                loading={allQ.isLoading}
                pagination={{ pageSize: 50 }}
              />
            ),
          },
        ]}
      />

      <Modal
        title={`Отклонить «${rejectFor?.name}»`}
        open={Boolean(rejectFor)}
        onCancel={() => setRejectFor(null)}
        onOk={() =>
          rejectFor &&
          decideM.mutate({
            id: rejectFor.id,
            payload: { approved: false, rejection_reason: rejectReason || "Не указано" },
          })
        }
        okText="Отклонить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Причина отклонения (увидит автор)"
        />
      </Modal>
    </>
  );
}
