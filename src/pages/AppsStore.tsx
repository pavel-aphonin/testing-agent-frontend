import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  LockOutlined,
  SearchOutlined,
  StarFilled,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  installApp,
  listInstallations,
  searchStore,
  uploadBundle,
} from "@/api/apps";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { AppPackageRead } from "@/types";
import { notify } from "@/utils/notify";

const CATEGORIES = [
  { value: "integration", label: "Интеграции" },
  { value: "automation", label: "Автоматизация" },
  { value: "visualization", label: "Визуализация" },
  { value: "utility", label: "Утилиты" },
];

export function AppsStore() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const storeQ = useQuery({
    queryKey: ["apps-store", q, category],
    queryFn: () => searchStore(q || undefined, category),
  });

  const installedQ = useQuery({
    queryKey: ["ws-apps", ws?.id ?? "none"],
    queryFn: () => (ws ? listInstallations(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const installedIds = useMemo(
    () => new Set((installedQ.data ?? []).map((i) => i.app_package_id)),
    [installedQ.data],
  );

  const installM = useMutation({
    mutationFn: (pkgId: string) => {
      if (!ws) return Promise.reject(new Error("Выберите рабочее пространство"));
      return installApp(ws.id, { app_package_id: pkgId });
    },
    onSuccess: () => {
      notify.success("Приложение установлено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка установки"),
  });

  const uploadM = useMutation({
    mutationFn: (file: File) => uploadBundle(file, { submit_for_review: true }),
    onSuccess: (pkg) => {
      notify.success(
        `Загружено: ${pkg.name} (${pkg.approval_status === "pending" ? "на модерации" : pkg.approval_status})`,
      );
      qc.invalidateQueries({ queryKey: ["apps-store"] });
      qc.invalidateQueries({ queryKey: ["apps-mine"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка загрузки"),
  });

  const canUpload = me && ((me.permissions ?? []).includes("dictionaries.create") || true);

  return (
    <>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
        size="middle"
        wrap
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          <AppstoreAddOutlined /> Магазин приложений
        </Typography.Title>
        <Space>
          {canUpload && (
            <Upload
              accept=".zip"
              showUploadList={false}
              beforeUpload={(file) => {
                uploadM.mutate(file);
                return false;
              }}
            >
              <Button icon={<CloudUploadOutlined />} loading={uploadM.isPending}>
                Загрузить приложение
              </Button>
            </Upload>
          )}
        </Space>
      </Space>

      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Поиск по названию, коду, автору..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 340 }}
          allowClear
        />
        <Select
          placeholder="Категория"
          allowClear
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          style={{ width: 200 }}
        />
      </Space>

      {storeQ.isLoading ? null : (storeQ.data?.length ?? 0) === 0 ? (
        <Empty description="Ничего не найдено" />
      ) : (
        <Row gutter={[16, 16]}>
          {(storeQ.data ?? []).map((pkg) => (
            <Col key={pkg.id} xs={24} sm={12} md={8} lg={6}>
              <AppCard
                pkg={pkg}
                installed={installedIds.has(pkg.id)}
                onInstall={() => installM.mutate(pkg.id)}
                onOpen={() => nav(`/apps/${pkg.id}`)}
                installing={installM.isPending && installM.variables === pkg.id}
              />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

function AppCard({
  pkg,
  installed,
  onInstall,
  onOpen,
  installing,
}: {
  pkg: AppPackageRead;
  installed: boolean;
  onInstall: () => void;
  onOpen: () => void;
  installing: boolean;
}) {
  const rating = pkg.avg_rating ?? 0;
  return (
    <Card
      size="small"
      hoverable
      onClick={onOpen}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Avatar
          shape="square"
          size={56}
          src={pkg.logo_path ? `${import.meta.env.VITE_API_BASE_URL ?? ""}/${pkg.logo_path.startsWith("/") ? pkg.logo_path.slice(1) : pkg.logo_path}` : undefined}
          icon={<AppstoreAddOutlined />}
          style={{ background: "#fafafa", color: "#999", flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: 14 }} ellipsis>
            {pkg.name}
          </Typography.Text>
          <div style={{ fontSize: 11, color: "#999" }}>
            {pkg.author || "—"} · v{pkg.latest_version ?? "—"}
          </div>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {!pkg.is_public && (
              <Tooltip title="Приватное (только в одном пространстве)">
                <Tag color="gold" icon={<LockOutlined />} style={{ marginRight: 4 }}>
                  Приватное
                </Tag>
              </Tooltip>
            )}
            {pkg.review_count > 0 && (
              <span style={{ color: "#faad14" }}>
                <StarFilled /> {rating.toFixed(1)}{" "}
                <span style={{ color: "#999" }}>({pkg.review_count})</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <Typography.Paragraph
        ellipsis={{ rows: 2 }}
        style={{ fontSize: 12, color: "#666", marginBottom: 12, minHeight: 36 }}
      >
        {pkg.description || "Описание отсутствует"}
      </Typography.Paragraph>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Tag>{pkg.category}</Tag>
        {installed ? (
          <Tag icon={<CheckCircleOutlined />} color="green">
            Установлено
          </Tag>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            loading={installing}
            onClick={(e) => {
              e.stopPropagation();
              onInstall();
            }}
          >
            Установить
          </Button>
        )}
      </Space>
    </Card>
  );
}
