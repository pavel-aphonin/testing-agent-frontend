import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  LockOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Image,
  Input,
  List,
  Rate,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";

import { bundleAssetUrl, bundleFileUrl } from "@/api/apps";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteReview,
  getPackage,
  installApp,
  listInstallations,
  listReviews,
  listVersions,
  upsertReview,
} from "@/api/apps";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import { notify } from "@/utils/notify";

export function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();

  const pkgQ = useQuery({
    queryKey: ["app-pkg", id],
    queryFn: () => (id ? getPackage(id) : Promise.reject()),
    enabled: Boolean(id),
  });
  const versionsQ = useQuery({
    queryKey: ["app-versions", id],
    queryFn: () => (id ? listVersions(id) : Promise.resolve([])),
    enabled: Boolean(id),
  });
  const reviewsQ = useQuery({
    queryKey: ["app-reviews", id],
    queryFn: () => (id ? listReviews(id) : Promise.resolve([])),
    enabled: Boolean(id),
  });
  const installedQ = useQuery({
    queryKey: ["ws-apps", ws?.id ?? "none"],
    queryFn: () => (ws ? listInstallations(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });
  const installed = installedQ.data?.find((i) => i.app_package_id === id);

  const myReview = reviewsQ.data?.find((r) => r.user_id === me?.id);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");

  const installM = useMutation({
    mutationFn: () => {
      if (!ws || !id) return Promise.reject();
      return installApp(ws.id, { app_package_id: id });
    },
    onSuccess: () => {
      notify.success("Приложение установлено");
      qc.invalidateQueries({ queryKey: ["ws-apps"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const reviewM = useMutation({
    mutationFn: () => {
      if (!id) return Promise.reject();
      return upsertReview(id, { rating: draftRating, text: draftText || undefined });
    },
    onSuccess: () => {
      notify.success("Отзыв сохранён");
      setDraftRating(0);
      setDraftText("");
      qc.invalidateQueries({ queryKey: ["app-reviews", id] });
      qc.invalidateQueries({ queryKey: ["app-pkg", id] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delReviewM = useMutation({
    mutationFn: () => (id ? deleteReview(id) : Promise.reject()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-reviews", id] });
      qc.invalidateQueries({ queryKey: ["app-pkg", id] });
    },
  });

  if (!pkgQ.data) return null;
  const pkg = pkgQ.data;

  return (
    <>
      <Button onClick={() => nav("/apps/store")} style={{ marginBottom: 16 }}>
        ← К магазину
      </Button>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card>
            <Space align="start" size={24}>
              <Avatar
                shape="square"
                size={96}
                src={bundleAssetUrl(pkg.logo_path) ?? undefined}
                icon={<AppstoreAddOutlined />}
                style={{ background: "#fafafa", color: "#999" }}
              />
              <div style={{ flex: 1 }}>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
                  {pkg.name}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {pkg.author || "—"} · v{pkg.latest_version} · {pkg.install_count}{" "}
                  установок
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  {!pkg.is_public && (
                    <Tag color="gold" icon={<LockOutlined />}>
                      Приватное
                    </Tag>
                  )}
                  <Tag>{pkg.category}</Tag>
                  {pkg.review_count > 0 && (
                    <Tag icon={<StarFilled style={{ color: "#faad14" }} />} color="default">
                      {pkg.avg_rating?.toFixed(1)} ({pkg.review_count})
                    </Tag>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                  {installed ? (
                    <Tag icon={<CheckCircleOutlined />} color="green">
                      Установлено в этом пространстве
                    </Tag>
                  ) : (
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={installM.isPending}
                      onClick={() => installM.mutate()}
                      disabled={!ws}
                    >
                      Установить в «{ws?.name ?? "?"}»
                    </Button>
                  )}
                </div>
              </div>
            </Space>

            <Divider />

            {/* Screenshots gallery — uses the latest version's manifest */}
            {pkg.latest_version && (versionsQ.data?.[0]?.manifest?.screenshots ?? []).length > 0 && (
              <>
                <Typography.Title level={5}>Скриншоты</Typography.Title>
                <Image.PreviewGroup>
                  <Space wrap>
                    {(versionsQ.data![0].manifest.screenshots ?? []).map((s) => (
                      <Image
                        key={s.path}
                        width={160}
                        height={120}
                        style={{ objectFit: "cover", borderRadius: 6 }}
                        src={bundleFileUrl(pkg.code, versionsQ.data![0].version, s.path)}
                        alt={s.caption ?? s.path}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
                <Divider />
              </>
            )}

            <Typography.Title level={5}>Описание</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {pkg.description || "Описание отсутствует"}
            </Typography.Paragraph>

            <Divider />

            <Typography.Title level={5}>Отзывы</Typography.Title>
            <div style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  <span>Ваша оценка:</span>
                  <Rate
                    value={draftRating || myReview?.rating || 0}
                    onChange={setDraftRating}
                  />
                  {myReview && (
                    <Button size="small" type="link" danger onClick={() => delReviewM.mutate()}>
                      Удалить мой отзыв
                    </Button>
                  )}
                </Space>
                <Input.TextArea
                  rows={2}
                  placeholder={myReview?.text || "Ваш отзыв..."}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
                <Button
                  type="primary"
                  size="small"
                  disabled={!draftRating}
                  loading={reviewM.isPending}
                  onClick={() => reviewM.mutate()}
                >
                  {myReview ? "Обновить отзыв" : "Опубликовать отзыв"}
                </Button>
              </Space>
            </div>

            {(reviewsQ.data?.length ?? 0) === 0 ? (
              <Empty description="Отзывов пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={reviewsQ.data}
                renderItem={(r) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<StarOutlined />}
                      title={
                        <Space>
                          <span>{r.user_email}</span>
                          <Rate disabled value={r.rating} style={{ fontSize: 12 }} />
                        </Space>
                      }
                      description={
                        <>
                          {r.text && <div>{r.text}</div>}
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(r.created_at).toLocaleString()}
                          </Typography.Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Информация" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Код">
                <Typography.Text code>{pkg.code}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Tag
                  color={
                    pkg.approval_status === "approved"
                      ? "green"
                      : pkg.approval_status === "pending"
                      ? "blue"
                      : pkg.approval_status === "rejected"
                      ? "red"
                      : "default"
                  }
                >
                  {pkg.approval_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Создано">
                {new Date(pkg.created_at).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={`Версии (${versionsQ.data?.length ?? 0})`} size="small" style={{ marginTop: 16 }}>
            {(versionsQ.data?.length ?? 0) === 0 ? (
              <Empty description="Нет версий" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={versionsQ.data}
                renderItem={(v) => (
                  <List.Item style={{ display: "block" }}>
                    <Space>
                      <Tag color={v.is_deprecated ? "default" : "blue"}>v{v.version}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </Typography.Text>
                      {v.is_deprecated && <Tag>Устарела</Tag>}
                    </Space>
                    {v.changelog && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "#555",
                          whiteSpace: "pre-wrap",
                          background: "#fafafa",
                          padding: "8px 10px",
                          borderRadius: 4,
                          borderLeft: "3px solid #EE3424",
                        }}
                      >
                        {v.changelog}
                      </div>
                    )}
                  </List.Item>
                )}
              />
            )}
          </Card>

          {pkg.approval_status === "rejected" && pkg.rejection_reason && (
            <Alert
              type="error"
              message="Приложение отклонено"
              description={pkg.rejection_reason}
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Col>
      </Row>
    </>
  );
}
