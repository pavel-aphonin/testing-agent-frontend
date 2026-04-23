import {
  AppstoreAddOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  LockOutlined,
  SearchOutlined,
  StarFilled,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AutoComplete,
  Avatar,
  Button,
  Empty,
  Input,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  bundleAssetUrl,
  installApp,
  listInstallations,
  searchStore,
  uploadBundle,
} from "@/api/apps";
import { listRef } from "@/api/reference";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import type { AppPackageRead } from "@/types";
import { notify } from "@/utils/notify";

export function AppsStore() {
  const ws = useWorkspaceStore((s) => s.current);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  // Category chips come from a reference dictionary admins can edit.
  // Only active rows surface to regular users; order honours
  // ``sort_order`` from the backend.
  const categoriesQ = useQuery({
    queryKey: ["ref", "app-categories", "active"],
    queryFn: () => listRef("app-categories", { active_only: "true" }),
  });
  const categories = categoriesQ.data ?? [];
  const categoryLabel = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.code, c.name])) as Record<string, string>,
    [categories],
  );

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

  const canUpload = Boolean(me && (me.permissions ?? []).includes("apps.upload"));

  const data = storeQ.data ?? [];
  const searching = q.trim().length > 0 || Boolean(category);

  // Always-available catalog for autocomplete — separate query from the
  // filtered ``storeQ`` so typing into the box doesn't shrink the
  // suggestion pool (the user is typing the needle; we shouldn't reduce
  // the haystack at the same time).
  const catalogQ = useQuery({
    queryKey: ["apps-store-all"],
    queryFn: () => searchStore(undefined, undefined),
  });

  // Local substring match on name + description. Cheap — catalog is
  // small, and we don't want a round-trip per keystroke.
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !catalogQ.data) return [];
    return catalogQ.data
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.description ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 8)
      .map((p) => ({
        value: p.name,
        pkg: p,
        label: (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0" }}>
            <Avatar
              shape="square"
              size={28}
              src={bundleAssetUrl(p.logo_path) ?? undefined}
              icon={<AppstoreAddOutlined />}
              style={{ background: "#fafafa", color: "#999", flexShrink: 0, borderRadius: 6 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: "#8c8c8c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.description || "—"}
              </div>
            </div>
          </div>
        ),
      }));
  }, [q, catalogQ.data]);

  // Pre-compute sections for the non-search view: featured (with cover),
  // popular (by install count), recently added.
  const featured = useMemo(
    () => data.filter((p) => p.cover_path).slice(0, 3),
    [data],
  );
  const popular = useMemo(
    () => [...data].sort((a, b) => b.install_count - a.install_count).slice(0, 8),
    [data],
  );
  const fresh = useMemo(
    () =>
      [...data]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 8),
    [data],
  );

  return (
    <>
      {/* Local type scale + card hover polish — scoped to .store-page */}
      <style>{`
        .store-page h1.store-hero-title{
          font-size: 32px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.5px;
        }
        .store-page .hero-subtitle{font-size: 15px; color: #595959}
        .store-page .section-head{
          display:flex; align-items:baseline; justify-content:space-between;
          margin: 28px 0 12px;
        }
        .store-page .section-title{font-size: 20px; font-weight: 600; margin:0; letter-spacing: -0.3px}
        .store-page .section-sub{color:#8c8c8c; font-size: 13px; margin-top: 2px}
        .store-page .hero-card{
          position:relative; overflow:hidden; border-radius: 16px;
          cursor:pointer; transition: transform .25s;
          background:#fafafa; border: 1px solid #ececec;
        }
        .store-page .hero-card:hover{transform: translateY(-2px)}
        .store-page .hero-cover{
          height: 260px; background-size:cover; background-position:center;
        }
        .store-page .hero-body{padding: 18px 22px 20px}
        .store-page .hero-app-title{font-size: 22px; font-weight: 600; margin: 0 0 2px; letter-spacing: -0.3px}
        .store-page .hero-app-sub{font-size: 13px; color:#8c8c8c}
        .store-page .app-tile{
          border-radius: 14px; padding: 18px; background:#fff; border:1px solid #ececec;
          cursor:pointer; transition: all .2s; height: 100%;
          display:flex; flex-direction:column; gap: 10px;
        }
        .store-page .app-tile:hover{
          border-color:#EE3424; box-shadow: 0 4px 16px rgba(238,52,36,0.08);
          transform: translateY(-2px);
        }
        .store-page .app-tile .tile-head{display:flex; gap: 12px; align-items:flex-start}
        .store-page .app-tile .tile-body{flex:1; min-width: 0}
        .store-page .app-tile .tile-name{
          font-size: 15px; font-weight: 600; margin: 0 0 2px;
          white-space: nowrap; overflow:hidden; text-overflow: ellipsis;
        }
        .store-page .app-tile .tile-desc{
          font-size: 12.5px; color:#595959; line-height: 1.45;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; min-height: 36px;
        }
        .store-page .app-tile .tile-foot{
          display:flex; justify-content:space-between; align-items:center;
          font-size: 12px; color:#8c8c8c; margin-top:auto;
        }
        .store-page .app-tile .tile-rating{display:inline-flex; gap: 4px; align-items:center; color:#faad14}
        .store-page .cat-chips{display:flex; gap: 8px; flex-wrap:wrap}
        .store-page .cat-chip{
          padding: 6px 14px; border-radius: 999px; font-size: 13px;
          background:#f5f5f5; color:#595959; cursor:pointer; transition:.15s;
          border: 1px solid transparent; display:inline-flex; align-items:center; gap: 6px;
        }
        .store-page .cat-chip:hover{background:#fafafa; border-color:#d9d9d9}
        .store-page .cat-chip.active{background:#fff3f3; color:#EE3424; border-color:#EE3424}
        .store-page .row-grid{
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        @media (min-width: 1400px){
          .store-page .row-grid{grid-template-columns: repeat(4, 1fr);}
        }
      `}</style>

      <div className="store-page">
        {/* ═══ Hero ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h1 className="store-hero-title">Магазин приложений</h1>
            <div className="hero-subtitle">
              Расширения для Маркова: интеграции с LLM и трекерами, автоматизации, визуализации.
            </div>
          </div>
          {canUpload && (
            <Upload
              accept=".zip"
              showUploadList={false}
              beforeUpload={(file) => {
                uploadM.mutate(file);
                return false;
              }}
            >
              <Button icon={<CloudUploadOutlined />} loading={uploadM.isPending} size="large">
                Загрузить приложение
              </Button>
            </Upload>
          )}
        </div>

        {/* Search on its own full-width row, with autocomplete. Selecting
            a suggestion jumps straight to that app's detail page. */}
        <AutoComplete
          popupMatchSelectWidth
          options={suggestions as any}
          onSelect={(_, opt: any) => {
            if (opt?.pkg?.id) nav(`/apps/${opt.pkg.id}`);
          }}
          style={{ width: "100%" }}
        >
          <Input
            size="large"
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            placeholder="Найти приложение по названию или описанию…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ borderRadius: 12 }}
            allowClear
          />
        </AutoComplete>
        <div className="cat-chips" style={{ marginTop: 14, marginBottom: 8 }}>
          <div
            className={`cat-chip ${!category ? "active" : ""}`}
            onClick={() => setCategory(undefined)}
          >
            Все
          </div>
          {categories.map((c) => (
            <div
              key={c.code}
              className={`cat-chip ${category === c.code ? "active" : ""}`}
              onClick={() => setCategory(c.code === category ? undefined : c.code)}
            >
              {c.icon && <span>{c.icon}</span>}
              <span>{c.name}</span>
            </div>
          ))}
        </div>

        {/* ═══ Content ═══ */}
        {storeQ.isLoading ? null : data.length === 0 ? (
          <Empty description="Ничего не найдено" style={{ marginTop: 64 }} />
        ) : searching ? (
          // Search/filter results: flat grid, no sections.
          <div style={{ marginTop: 24 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Найдено приложений: {data.length}
            </Typography.Text>
            <div className="row-grid" style={{ marginTop: 12 }}>
              {data.map((pkg) => (
                <AppTile
                  key={pkg.id}
                  pkg={pkg}
                  installed={installedIds.has(pkg.id)}
                  onOpen={() => nav(`/apps/${pkg.id}`)}
                  onInstall={() => installM.mutate(pkg.id)}
                  installing={installM.isPending && installM.variables === pkg.id}
                  categoryLabel={categoryLabel}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section>
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Рекомендуем</h2>
                    <div className="section-sub">Интеграции и инструменты, которые закрывают частые задачи</div>
                  </div>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: featured.length === 1 ? "1fr" : `repeat(${featured.length}, 1fr)`,
                  gap: 16,
                }}>
                  {featured.map((pkg) => (
                    <HeroCard
                      key={pkg.id}
                      pkg={pkg}
                      installed={installedIds.has(pkg.id)}
                      onOpen={() => nav(`/apps/${pkg.id}`)}
                      onInstall={() => installM.mutate(pkg.id)}
                      installing={installM.isPending && installM.variables === pkg.id}
                      categoryLabel={categoryLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {popular.length > 0 && (
              <section>
                <div className="section-head">
                  <div>
                    <h2 className="section-title">
                      <ThunderboltOutlined style={{ color: "#faad14", marginRight: 8 }} />
                      Популярные в вашей компании
                    </h2>
                    <div className="section-sub">Чем пользуются другие команды</div>
                  </div>
                </div>
                <div className="row-grid">
                  {popular.map((pkg) => (
                    <AppTile
                      key={pkg.id}
                      pkg={pkg}
                      installed={installedIds.has(pkg.id)}
                      onOpen={() => nav(`/apps/${pkg.id}`)}
                      onInstall={() => installM.mutate(pkg.id)}
                      installing={installM.isPending && installM.variables === pkg.id}
                      categoryLabel={categoryLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {fresh.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Новое и обновлённое</h2>
                    <div className="section-sub">Свежие релизы за последнее время</div>
                  </div>
                </div>
                <div className="row-grid">
                  {fresh.map((pkg) => (
                    <AppTile
                      key={pkg.id}
                      pkg={pkg}
                      installed={installedIds.has(pkg.id)}
                      onOpen={() => nav(`/apps/${pkg.id}`)}
                      onInstall={() => installM.mutate(pkg.id)}
                      installing={installM.isPending && installM.variables === pkg.id}
                      categoryLabel={categoryLabel}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ── Hero card: wide banner with cover + strong CTA ─────────────────── */
function HeroCard({
  pkg,
  installed,
  onOpen,
  onInstall,
  installing,
  categoryLabel,
}: {
  pkg: AppPackageRead;
  installed: boolean;
  onOpen: () => void;
  onInstall: () => void;
  installing: boolean;
  categoryLabel: Record<string, string>;
}) {
  const cover = bundleAssetUrl(pkg.cover_path);
  const logo = bundleAssetUrl(pkg.logo_path);
  return (
    <div className="hero-card" onClick={onOpen}>
      {cover && (
        <div
          className="hero-cover"
          style={{ backgroundImage: `url("${cover}")` }}
        />
      )}
      <div className="hero-body" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Avatar
          shape="square"
          size={56}
          src={logo ?? undefined}
          icon={<AppstoreAddOutlined />}
          style={{
            background: "#fafafa",
            marginTop: cover ? -32 : 0,
            border: "3px solid #fff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="hero-app-title">{pkg.name}</h3>
          <div className="hero-app-sub">
            {pkg.author || "—"} · {categoryLabel[pkg.category] ?? pkg.category}
            {pkg.review_count > 0 && (
              <span style={{ marginLeft: 10, color: "#faad14" }}>
                <StarFilled /> {pkg.avg_rating?.toFixed(1)}
              </span>
            )}
          </div>
          <Typography.Paragraph
            style={{ margin: "10px 0 14px", color: "#595959", fontSize: 13, lineHeight: 1.5 }}
            ellipsis={{ rows: 2 }}
          >
            {pkg.description}
          </Typography.Paragraph>
          <Space>
            {installed ? (
              <Tag icon={<CheckCircleOutlined />} color="green" style={{ borderRadius: 10, padding: "3px 10px" }}>
                Установлено
              </Tag>
            ) : (
              <Button
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
            <Button type="text" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
              Подробнее <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
}

/* ── Compact tile for popular / fresh sections and search results ───── */
function AppTile({
  pkg,
  installed,
  onOpen,
  onInstall,
  installing,
  categoryLabel,
}: {
  pkg: AppPackageRead;
  installed: boolean;
  onOpen: () => void;
  onInstall: () => void;
  installing: boolean;
  categoryLabel: Record<string, string>;
}) {
  const logo = bundleAssetUrl(pkg.logo_path);
  return (
    <div className="app-tile" onClick={onOpen}>
      <div className="tile-head">
        <Avatar
          shape="square"
          size={48}
          src={logo ?? undefined}
          icon={<AppstoreAddOutlined />}
          style={{ background: "#fafafa", color: "#999", flexShrink: 0, borderRadius: 10 }}
        />
        <div className="tile-body">
          <div className="tile-name">{pkg.name}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {pkg.author || "—"}
            {!pkg.is_public && (
              <Tag
                color="gold"
                icon={<LockOutlined />}
                style={{ marginLeft: 6, borderRadius: 8, fontSize: 10, lineHeight: "16px", padding: "0 6px" }}
              >
                Приватное
              </Tag>
            )}
          </div>
        </div>
      </div>
      <Typography.Paragraph
        className="tile-desc"
        style={{ margin: 0 }}
        ellipsis={{ rows: 2 }}
      >
        {pkg.description || "Описание отсутствует"}
      </Typography.Paragraph>
      <div className="tile-foot">
        <span>
          <Tag
            style={{ marginRight: 4, borderRadius: 8, fontSize: 11, padding: "0 8px", lineHeight: "18px" }}
          >
            {categoryLabel[pkg.category] ?? pkg.category}
          </Tag>
          {pkg.review_count > 0 && (
            <span className="tile-rating">
              <StarFilled style={{ fontSize: 11 }} /> {pkg.avg_rating?.toFixed(1)}
            </span>
          )}
        </span>
        {installed ? (
          <Tag icon={<CheckCircleOutlined />} color="green" style={{ borderRadius: 8, fontSize: 11, padding: "0 8px", lineHeight: "18px" }}>
            Установлено
          </Tag>
        ) : (
          <Button
            size="small"
            type="primary"
            ghost
            onClick={(e) => {
              e.stopPropagation();
              onInstall();
            }}
            loading={installing}
            style={{ borderRadius: 8 }}
          >
            Установить
          </Button>
        )}
      </div>
    </div>
  );
}
