import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LockOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Collapse,
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
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
import { listRef } from "@/api/reference";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import { notify } from "@/utils/notify";

export function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { token: t } = antdTheme.useToken();

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
  // Whether the review form is visible. Hidden by default when the
  // user already has a review (we show the rendered review + "edit"
  // button instead). Shown when there's no review, or when the user
  // explicitly clicked "Edit".
  const [editing, setEditing] = useState(false);

  // When the user clicks "Edit", seed the form with their existing
  // review. When they click "Cancel" or submit, reset back to clean.
  const startEdit = () => {
    if (myReview) {
      setDraftRating(myReview.rating);
      setDraftText(myReview.text ?? "");
    }
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraftRating(0);
    setDraftText("");
  };

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
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["app-reviews", id] });
      qc.invalidateQueries({ queryKey: ["app-pkg", id] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const delReviewM = useMutation({
    mutationFn: () => (id ? deleteReview(id) : Promise.reject()),
    onSuccess: () => {
      // After deletion the user can post a new one → surface the
      // form again so they don't have to hunt for it.
      setEditing(true);
      setDraftRating(0);
      setDraftText("");
      qc.invalidateQueries({ queryKey: ["app-reviews", id] });
      qc.invalidateQueries({ queryKey: ["app-pkg", id] });
    },
  });

  // Category labels from the admin-editable reference dictionary.
  // NOTE: this hook *must* sit above the early-return below — React's
  // rules of hooks require the same hook order on every render. We
  // previously put it after the ``if (!pkgQ.data) return null`` guard,
  // which caused React error #310 on the first pass (the first render
  // returned null before this hook got a chance to register).
  const categoriesQ = useQuery({
    queryKey: ["ref", "app-categories", "active"],
    queryFn: () => listRef("app-categories", { active_only: "true" }),
    staleTime: 5 * 60 * 1000,
  });

  if (!pkgQ.data) return null;
  const pkg = pkgQ.data;
  const coverUrl = bundleAssetUrl(pkg.cover_path);

  // Russian labels for statuses — keep them in one place so we don't
  // accidentally leak English tokens like "approved" into the UI.
  const STATUS_RU: Record<string, string> = {
    draft: "Черновик",
    pending: "На модерации",
    approved: "Опубликовано",
    rejected: "Отклонено",
  };
  const CATEGORY_RU: Record<string, string> = Object.fromEntries(
    (categoriesQ.data ?? []).map((c) => [c.code, c.name]),
  );
  const ruDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ru-RU"); // → ДД.ММ.ГГГГ

  // Russian noun declension for counts (5, 6, …, 20 → plural-genitive;
  // 2-4 → plural-nominative; 1 (except 11) → singular). Skipping a
  // proper Intl.PluralRules dance because we only need a couple of
  // nouns on this page.
  const plural = (n: number, forms: [string, string, string]) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return forms[2];
    if (mod10 === 1) return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
  };
  const reviewsWord = (n: number) => plural(n, ["отзыв", "отзыва", "отзывов"]);
  const installsWord = (n: number) => plural(n, ["установка", "установки", "установок"]);

  return (
    <>
      {/* Local markdown typography — compact, matches Ant Design's rhythm.
          Only affects .markdown-body so it doesn't leak into forms/tables. */}
      {/* Markdown typography — всё, что касается цветов, идёт из
          активной темы AntD, чтобы читалось и в светлой, и в тёмной. */}
      <style>{`
        .markdown-body { color: ${t.colorText}; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          margin: 12px 0 6px; font-size: 14px; font-weight: 600;
          color: ${t.colorText};
        }
        .markdown-body h1 { font-size: 16px; }
        .markdown-body p { margin: 4px 0; }
        .markdown-body ul, .markdown-body ol { margin: 4px 0; padding-left: 20px; }
        .markdown-body li { margin: 2px 0; }
        .markdown-body code {
          background: ${t.colorFillTertiary}; padding: 1px 4px; border-radius: 3px;
          font-size: 12px; color: ${t.colorText};
        }
        .markdown-body pre {
          background: ${t.colorFillQuaternary}; padding: 8px 10px; border-radius: 4px;
          overflow-x: auto; font-size: 12px; color: ${t.colorText};
        }
        .markdown-body a { color: ${t.colorLink}; }
        .markdown-body blockquote {
          border-left: 3px solid ${t.colorPrimary}; padding-left: 10px;
          color: ${t.colorTextSecondary}; margin: 6px 0;
        }
      `}</style>
      <Button onClick={() => nav("/apps/store")} style={{ marginBottom: 16 }}>
        ← К магазину
      </Button>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card styles={{ body: { padding: 0 } }}>
            {/* Wide hero banner (optional). Bundled as cover.{png,jpg,jpeg,webp}. */}
            {coverUrl && (
              <div
                style={{
                  width: "100%",
                  height: 180,
                  background: `url(${coverUrl}) center / cover no-repeat`,
                  borderRadius: "8px 8px 0 0",
                }}
              />
            )}
            <div style={{ padding: 24 }}>
            <Space align="start" size={24} style={{ width: "100%" }}>
              <Avatar
                shape="square"
                size={96}
                src={bundleAssetUrl(pkg.logo_path) ?? undefined}
                icon={<AppstoreAddOutlined />}
                style={{
                  background: t.colorFillQuaternary,
                  color: t.colorTextTertiary,
                  marginTop: coverUrl ? -48 : 0,
                  // Theme-aware border so the "notch" around the logo
                  // works on both light and dark cards.
                  border: coverUrl ? `4px solid ${t.colorBgContainer}` : undefined,
                  boxShadow: coverUrl ? t.boxShadowTertiary : undefined,
                }}
              />
              <div style={{ flex: 1 }}>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
                  {pkg.name}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {pkg.author || "—"} · v{pkg.latest_version} · {pkg.install_count}{" "}
                  {installsWord(pkg.install_count)}
                </Typography.Text>
                {/* Average rating — visible right under the title with stars,
                    not just as a tag. Shows "—" when there are no reviews so
                    the slot doesn't jump when the first review comes in. */}
                <div style={{ marginTop: 6 }}>
                  <Space size={8}>
                    <Rate
                      disabled
                      allowHalf
                      value={pkg.avg_rating ?? 0}
                      style={{ fontSize: 14 }}
                    />
                    {pkg.review_count > 0 ? (
                      <Typography.Text strong>
                        {pkg.avg_rating?.toFixed(1)}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">—</Typography.Text>
                    )}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {pkg.review_count > 0
                        ? `(${pkg.review_count} ${reviewsWord(pkg.review_count)})`
                        : "нет отзывов"}
                    </Typography.Text>
                  </Space>
                </div>
                <div style={{ marginTop: 8 }}>
                  {!pkg.is_public && (
                    <Tag color="gold" icon={<LockOutlined />}>
                      Приватное
                    </Tag>
                  )}
                  <Tag>{CATEGORY_RU[pkg.category] ?? pkg.category}</Tag>
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

            {/* Three states for the user's own review:
                1) Have a review, not editing → render it with Edit/Delete
                2) Editing an existing review → form pre-filled, Save + Cancel
                3) No review (or just deleted one) → blank form to publish */}
            {myReview && !editing ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 14px",
                  background: t.colorFillQuaternary,
                  borderRadius: 8,
                  border: `1px solid ${t.colorBorderSecondary}`,
                }}
              >
                <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Ваш отзыв
                    </Typography.Text>
                    <div style={{ margin: "2px 0 4px" }}>
                      <Rate disabled value={myReview.rating} style={{ fontSize: 14 }} />
                    </div>
                    {myReview.text && (
                      <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {myReview.text}
                      </Typography.Paragraph>
                    )}
                  </div>
                  <Space size={0}>
                    <Tooltip title="Редактировать">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={startEdit}
                      />
                    </Tooltip>
                    <Tooltip title="Удалить отзыв">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={delReviewM.isPending}
                        onClick={() => delReviewM.mutate()}
                      />
                    </Tooltip>
                  </Space>
                </Space>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space>
                    <span>Ваша оценка:</span>
                    <Rate value={draftRating} onChange={setDraftRating} />
                  </Space>
                  <Input.TextArea
                    rows={3}
                    placeholder="Напишите пару слов об опыте использования…"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                  />
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      disabled={!draftRating}
                      loading={reviewM.isPending}
                      onClick={() => reviewM.mutate()}
                    >
                      {myReview ? "Сохранить изменения" : "Опубликовать отзыв"}
                    </Button>
                    {editing && (
                      <Button size="small" onClick={cancelEdit}>
                        Отмена
                      </Button>
                    )}
                  </Space>
                </Space>
              </div>
            )}

            {(() => {
              // Hide the current user's own review from the public list
              // — we already show it (editable) in the box above.
              const others = (reviewsQ.data ?? []).filter((r) => r.user_id !== me?.id);
              if (others.length === 0) {
                return <Empty description="Отзывов от других пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
              }
              return (
                <List
                  dataSource={others}
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
                            {new Date(r.created_at).toLocaleString("ru-RU")}
                          </Typography.Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
                />
              );
            })()}
            </div>
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
                  {STATUS_RU[pkg.approval_status] ?? pkg.approval_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Создано">
                {ruDate(pkg.created_at)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={`Что нового (${versionsQ.data?.length ?? 0})`} size="small" style={{ marginTop: 16 }}>
            {(versionsQ.data?.length ?? 0) === 0 ? (
              <Empty description="Нет версий" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              // Versions are returned newest-first; we open the first (latest)
              // panel by default — most users only care about the new stuff.
              // Prior releases fold up but stay accessible one click away.
              <Collapse
                size="small"
                accordion={false}
                defaultActiveKey={[versionsQ.data![0]!.id]}
                items={versionsQ.data!.map((v, idx) => {
                  // Colour coding:
                  //   • latest published (index 0) → green (green)
                  //   • deprecated → red (deprecated / "не поддерживается")
                  //   • everything else → default (passive history)
                  const isLatest = idx === 0 && !v.is_deprecated;
                  const tagColor: string = v.is_deprecated
                    ? "red"
                    : isLatest
                    ? "green"
                    : "default";
                  return {
                    key: v.id,
                    label: (
                      <Space>
                        <Tag color={tagColor}>v{v.version}</Tag>
                        {isLatest && (
                          <Tag color="green" style={{ fontSize: 10 }}>
                            актуальная
                          </Tag>
                        )}
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {ruDate(v.created_at)}
                        </Typography.Text>
                        {v.is_deprecated && <Tag color="red">не поддерживается</Tag>}
                      </Space>
                    ),
                    children: v.changelog ? (
                    // Color now comes from the ``.markdown-body`` CSS
                    // above (which is themed), no inline override.
                    <div className="markdown-body" style={{ fontSize: 13 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {v.changelog}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <Typography.Text type="secondary" italic>
                      без описания
                    </Typography.Text>
                  ),
                  };
                })}
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
