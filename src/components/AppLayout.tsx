import {
  ApiOutlined,
  AppstoreAddOutlined,
  AppstoreOutlined,
  BookOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  MobileOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Dropdown, Layout, Menu, Space, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import * as AntIcons from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";

import { listInstallations } from "@/api/apps";
import { avatarAssetUrl } from "@/api/profile";
import { getMySettings } from "@/api/settings";
import { AppRunner } from "@/components/AppRunner";
import { AppSlots } from "@/components/AppSlots";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MarkovLogo } from "@/components/MarkovLogo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { WhatsNewPlaque, useWhatsNew } from "@/components/WhatsNew";
import { useBranding } from "@/hooks/useBranding";
import { useThemeStore, type ThemeMode } from "@/store/theme";
import { WorkerStatusBadge } from "@/components/WorkerStatusBadge";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";

const { Header, Sider, Content } = Layout;

const APP_VERSION = "0.5.0";
const APP_BUILD = "2026.04.23";

const MIN_SIDER_WIDTH = 200;
const MAX_SIDER_WIDTH = 480;
const COLLAPSED_WIDTH = 60;
const DEFAULT_WIDTH = 240;

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const branding = useBranding();
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const isDark = resolvedTheme === "dark";

  // Colors that the layout hard-codes (Header bg, borders, body surface).
  // Antd's ConfigProvider covers components but these are plain divs.
  const surface = isDark ? "#1f1f1f" : "#fff";
  const pageBg = isDark ? "#141414" : "#F5F5F5";
  const borderLine = isDark ? "#303030" : "#f0f0f0";

  // Title + favicon sync now lives in <BrandingSync /> at the App root,
  // so it also runs on /login where this layout isn't mounted.

  // Persisted UI state
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    localStorage.getItem("ta-sider-collapsed") === "1",
  );
  const [siderWidth, setSiderWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("ta-sider-width"));
    return Number.isFinite(v) && v >= MIN_SIDER_WIDTH && v <= MAX_SIDER_WIDTH
      ? v
      : DEFAULT_WIDTH;
  });
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    // Default: Workspace group open, System group collapsed.
    // Users see their runs/scenarios/etc. right away; admin-y stuff is
    // one click away.
    try {
      const raw = localStorage.getItem("ta-sider-groups");
      return raw ? JSON.parse(raw) : ["ws"];
    } catch {
      return ["ws"];
    }
  });

  useEffect(() => {
    localStorage.setItem("ta-sider-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem("ta-sider-width", String(siderWidth));
  }, [siderWidth]);
  useEffect(() => {
    localStorage.setItem("ta-sider-groups", JSON.stringify(openGroups));
  }, [openGroups]);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sidebarAppOpen, setSidebarAppOpen] = useState<{
    inst: any;
    path: string;
  } | null>(null);

  const perms = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions],
  );

  // Installed apps for the active workspace — used to inject sidebar slots.
  const currentWs = useWorkspaceStore((s) => s.current);
  const installedQ = useQuery({
    queryKey: ["ws-apps", currentWs?.id ?? "none"],
    queryFn: () => (currentWs ? listInstallations(currentWs.id) : Promise.resolve([])),
    enabled: Boolean(currentWs),
  });
  // Personal agent settings — powers the hidden_nav_items filter below.
  // Same query key as Profile so save+navigate updates the sidebar
  // without a hard refresh.
  const mySettingsQ = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    staleTime: 60_000,
  });
  const mySettings = mySettingsQ.data;
  const hasPerm = (p: string) => perms.has(p);

  // ── Resize handle ───────────────────────────────────────────────────────
  const draggingRef = useRef(false);
  function startResize(e: React.MouseEvent) {
    if (collapsed) return;
    draggingRef.current = true;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(MAX_SIDER_WIDTH, Math.max(MIN_SIDER_WIDTH, ev.clientX));
      setSiderWidth(next);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!user) return null;

  // ── Sidebar items grouped: System + Workspace ───────────────────────────
  type Item = { key: string; icon: React.ReactNode; label: React.ReactNode };

  const sysItems: Item[] = [];
  const wsItems: Item[] = [];

  // Workspace group
  if (hasPerm("runs.view")) {
    wsItems.push({
      key: "/runs",
      icon: <ExperimentOutlined />,
      label: <Link to="/runs">{t("nav.runs")}</Link>,
    });
  }
  if (hasPerm("scenarios.view")) {
    wsItems.push({
      key: "/admin/scenarios",
      icon: <PlayCircleOutlined />,
      label: <Link to="/admin/scenarios">{t("nav.scenarios")}</Link>,
    });
  }
  if (hasPerm("test_data.view")) {
    wsItems.push({
      key: "/test-data",
      icon: <DatabaseOutlined />,
      label: <Link to="/test-data">{t("nav.testData")}</Link>,
    });
  }
  if (hasPerm("knowledge.view")) {
    wsItems.push({
      key: "/admin/knowledge",
      icon: <BookOutlined />,
      label: <Link to="/admin/knowledge">{t("nav.knowledgeBase")}</Link>,
    });
  }
  // Workspace-context items (always shown)
  wsItems.push({
    key: "/workspace/members",
    icon: <TeamOutlined />,
    label: <Link to="/workspace/members">Участники пространства</Link>,
  });
  wsItems.push({
    key: "/workspace/apps",
    icon: <AppstoreAddOutlined />,
    label: <Link to="/workspace/apps">Приложения пространства</Link>,
  });

  // Sidebar slots from installed apps: appear below native workspace items.
  // Using a key prefix "app:" so our click handler can distinguish them
  // from regular nav items.
  //
  // Per-user pref `hidden_from_sidebar` lets people declutter their own
  // menu without affecting other workspace members. The pref is stored
  // per (user, installation) so it survives version updates.
  for (const inst of installedQ.data ?? []) {
    if (!inst.is_enabled) continue;
    if (inst.user_prefs?.hidden_from_sidebar) continue;
    const slots = inst.version?.manifest?.ui_slots ?? [];
    for (const s of slots) {
      if (s.slot !== "sidebar") continue;
      const IconComp = (AntIcons as any)[s.icon ?? "AppstoreOutlined"] ?? AntIcons.AppstoreOutlined;
      wsItems.push({
        key: `app:${inst.id}:${s.path || "frontend/index.html"}`,
        icon: <IconComp />,
        label: <span>{s.label}</span>,
      });
    }
  }

  // System group
  if (hasPerm("settings.view")) {
    sysItems.push({
      key: "/settings",
      icon: <SettingOutlined />,
      label: <Link to="/settings">{t("nav.settings")}</Link>,
    });
  }
  if (hasPerm("devices.view")) {
    sysItems.push({
      key: "/admin/devices",
      icon: <MobileOutlined />,
      label: <Link to="/admin/devices">{t("adminDevices.title")}</Link>,
    });
  }
  if (hasPerm("models.view")) {
    sysItems.push({
      key: "/admin/models",
      icon: <ApiOutlined />,
      label: <Link to="/admin/models">{t("nav.llmModels")}</Link>,
    });
  }
  if (hasPerm("users.view")) {
    sysItems.push({
      key: "/admin/users",
      icon: <TeamOutlined />,
      label: <Link to="/admin/users">{t("nav.users")}</Link>,
    });
  }
  if (hasPerm("dictionaries.view")) {
    sysItems.push({
      key: "/dictionaries",
      icon: <FileTextOutlined />,
      label: <Link to="/dictionaries">{t("nav.dictionaries")}</Link>,
    });
  }
  // Магазин приложений — открыт всем
  sysItems.push({
    key: "/apps/store",
    icon: <AppstoreAddOutlined />,
    label: <Link to="/apps/store">Магазин приложений</Link>,
  });
  if (hasPerm("dictionaries.edit")) {
    sysItems.push({
      key: "/admin/apps",
      icon: <SafetyCertificateOutlined />,
      label: <Link to="/admin/apps">Модерация приложений</Link>,
    });
  }

  // Admin inbox for help-page feedback tickets. Gated on the same
  // permission as the user admin page since only admins should be
  // reading these submissions.
  if (hasPerm("users.view")) {
    sysItems.push({
      key: "/admin/feedback",
      icon: <AntIcons.MessageOutlined />,
      label: <Link to="/admin/feedback">Обращения</Link>,
    });
  }

  // "Справка" lives in the System group (everyone has access but
  // conceptually it belongs with system-level items). "Профиль" is not
  // a menu item — the email/role block at the bottom links to /profile.
  sysItems.push({
    key: "/help",
    icon: <QuestionCircleOutlined />,
    label: <Link to="/help">Справка</Link>,
  });

  // Per-user hidden nav items from Profile → Навигация. We filter
  // the built-in menu lists (wsItems / sysItems) before rendering.
  // App slots under "app:" keys have their own per-installation
  // ``hidden_from_sidebar`` pref and are handled elsewhere.
  const hiddenNav = new Set<string>(mySettings?.hidden_nav_items ?? []);
  const visibleWsItems = wsItems.filter(
    (i) => !hiddenNav.has(String(i.key)),
  );
  const visibleSysItems = sysItems.filter(
    (i) => !hiddenNav.has(String(i.key)),
  );

  // ── Build menu structure ────────────────────────────────────────────────
  // When collapsed → flat list (labels hidden anyway, groups would just
  // waste space). When expanded → use SubMenu so groups can collapse.
  const menuItems: MenuProps["items"] = [];
  if (visibleWsItems.length > 0) {
    menuItems.push({
      key: "ws",
      label: "Рабочее пространство",
      icon: <AppstoreOutlined />,
      children: visibleWsItems,
    });
  }
  if (visibleSysItems.length > 0) {
    menuItems.push({
      key: "sys",
      label: "Система",
      icon: <SettingOutlined />,
      children: visibleSysItems,
    });
  }

  const collapsedItems: MenuProps["items"] = [
    ...visibleWsItems,
    { type: "divider" as const },
    ...visibleSysItems,
  ];

  const allKeys = [...visibleWsItems, ...visibleSysItems, { key: "/profile" }].map((i) => i.key);
  const selectedKey =
    allKeys
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? "/runs";

  // Auto-open the group that contains the active route, so someone
  // navigating directly to ``/settings`` sees the "Система" group open
  // with "Настройки" highlighted instead of a collapsed group.
  useEffect(() => {
    const inWs = wsItems.some((i) => i.key === selectedKey);
    const inSys = sysItems.some((i) => i.key === selectedKey);
    const want = inWs ? "ws" : inSys ? "sys" : null;
    if (want && !openGroups.includes(want)) {
      setOpenGroups((prev) => [...prev, want]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh", position: "relative" }}>
      {/* Resize handle — absolutely positioned on top of Sider's right
          edge. Using a wrapper so we don't fight AntD Sider's own
          positioning. zIndex has to beat the Menu. */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          style={{
            position: "fixed",
            top: 0,
            left: siderWidth - 2,
            width: 4,
            height: "100vh",
            cursor: "col-resize",
            zIndex: 1001,
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#EE342488")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
        />
      )}
      <Sider
        collapsed={collapsed}
        collapsedWidth={COLLAPSED_WIDTH}
        width={siderWidth}
        style={{
          height: "100vh",
          position: "sticky",
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          background: "var(--ta-sidebar-bg, #0B0B0B)",
          display: "flex",
          flexDirection: "column",
        }}
        trigger={null}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logo + collapse toggle.
              When collapsed → only the logo (toggle moves below).
              When expanded → logo + title + toggle on the right. */}
          <style>{`
            @keyframes flipLogo {
              0%, 40% { transform: rotateY(0deg); }
              50%, 90% { transform: rotateY(180deg); }
              100% { transform: rotateY(360deg); }
            }
          `}</style>
          <div
            style={{
              color: "#fff",
              padding: collapsed ? "16px 0 12px" : "20px 16px 16px",
              fontSize: 20,
              fontWeight: 700,
              borderBottom: "2px solid #EE3424",
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              flexDirection: collapsed ? "column" : "row",
              alignItems: "center",
              // Expanded: logo + name grouped on the left (flex-start) —
              // they read as a single "brand" unit, Linear/Notion style.
              // Collapsed: center the logo in the narrow column.
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 10,
            }}
          >
            <MarkovLogo
              size={32}
              logoUrl={branding.logoUrl}
              logoBackUrl={branding.logoBackUrl}
            />
            {!collapsed && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {branding.productName}
              </span>
            )}
          </div>
          {/* Legacy inline logo (no longer rendered) kept here only to keep
              the diff against previous layout readable. Remove after QA. */}
          {false && (
          <div style={{ display: "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  background: "#EE3424",
                  borderRadius: 8,
                  flexShrink: 0,
                  perspective: 400,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 32,
                    height: 32,
                    position: "relative",
                    transformStyle: "preserve-3d",
                    animation: "flipLogo 5s ease-in-out infinite",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backfaceVisibility: "hidden",
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    М
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      color: "#fff",
                      gap: 1,
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>A</span>
                    <span style={{ width: 14, height: 2.5, background: "#fff", borderRadius: 1 }} />
                  </span>
                </span>
              </span>
              {!collapsed && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t("auth.loginTitle")}
                </span>
              )}
            </span>
          </div>
          )}

          {/* Navigation */}
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin" }}>
            <Menu
              theme="dark"
              mode="inline"
              // When collapsed, Ant Menu switches to floating submenus and
              // tends to fire ``onOpenChange`` with a transient value that
              // overwrites our persisted state. We freeze the controlled
              // value to what the user had open last time in expanded mode,
              // and ignore change events while collapsed.
              selectedKeys={[selectedKey]}
              items={collapsed ? collapsedItems : menuItems}
              openKeys={collapsed ? [] : openGroups}
              onOpenChange={(keys) => {
                if (!collapsed) setOpenGroups(keys as string[]);
              }}
              style={{ borderRight: 0 }}
              onClick={({ key }) => {
                if (typeof key === "string" && key.startsWith("app:")) {
                  const [, instId, path] = key.split(":");
                  const inst = (installedQ.data ?? []).find((i) => i.id === instId);
                  if (inst) setSidebarAppOpen({ inst, path });
                }
              }}
            />
          </div>

          {/* «Что нового?» plaque — product changelog with an unread
              badge. Pinned right above the collapse toggle so it's
              always reachable. */}
          <div style={{ marginTop: 8 }}>
            <WhatsNewPlaque collapsed={collapsed} />
          </div>

          {/* Collapse toggle — sits above user info so it doesn't fight
              with the logo for space in collapsed mode. */}
          <div
            style={{
              borderTop: "1px solid #222",
              padding: collapsed ? "8px 0" : "8px 16px",
              flexShrink: 0,
              display: "flex",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <Tooltip title={collapsed ? "Развернуть меню" : ""} placement="right">
              <a
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  color: "#888",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  width: collapsed ? "auto" : "100%",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                {!collapsed && <span>Свернуть меню</span>}
              </a>
            </Tooltip>
          </div>

          {/* User info */}
          <div
            style={{
              borderTop: "1px solid #222",
              padding: collapsed ? "12px 8px" : "12px 16px",
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              <Tooltip title={`${user.email}\n${user.role_name || user.role}`} placement="right">
                <div
                  style={{ display: "flex", justifyContent: "center", cursor: "pointer" }}
                  onClick={() => navigate("/profile")}
                >
                  <UserAvatar size="small" />
                </div>
              </Tooltip>
            ) : (
              <>
                <Tooltip title="Открыть профиль" placement="right">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 6,
                      padding: 4,
                      margin: -4,
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/profile")}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <UserAvatar size="small" />
                    <div style={{ overflow: "hidden", lineHeight: 1.3 }}>
                      <Typography.Text style={{ color: "#fff", fontSize: 12, display: "block" }} ellipsis>
                        {user.email}
                      </Typography.Text>
                      <Typography.Text style={{ color: "#888", fontSize: 11 }}>
                        {user.role_name || t(`roles.${user.role}`)}
                      </Typography.Text>
                    </div>
                  </div>
                </Tooltip>
                {/* Clickable version line — opens the «Что нового» modal
                    so users have a second entry point from the footer. */}
                <VersionFooter />
              </>
            )}
          </div>
        </div>

        {/* Resize handle (only when expanded) */}
      </Sider>

      <Layout style={{ minWidth: 0, marginLeft: 0 }}>
        <Header
          style={{
            background: surface,
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${borderLine}`,
            height: 48,
            lineHeight: "48px",
          }}
        >
          <WorkspaceSwitcher />
          <Space size={24}>
            {/* App-provided top-bar actions */}
            <AppSlots slot="top_bar" />
            <WorkerStatusBadge />
            <NotificationsBell />
            <ThemeSwitcher />
            <Tooltip title="Открыть ассистента" placement="bottom">
              <a
                onClick={() => setAssistantOpen(true)}
                style={{
                  color: "#999",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#EE3424")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
              >
                <MessageOutlined /> Ассистент
              </a>
            </Tooltip>
            <a
              onClick={handleLogout}
              style={{
                color: "#999",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#EE3424")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
            >
              <LogoutOutlined /> {t("auth.signOut")}
            </a>
          </Space>
        </Header>

        <AssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} />

        {/* Floating corner buttons from installed apps */}
        <AppSlots slot="corner" fixed />

        {/* Sidebar app modal */}
        <AppRunner
          installation={sidebarAppOpen?.inst ?? null}
          slotPath={sidebarAppOpen?.path ?? null}
          onClose={() => setSidebarAppOpen(null)}
        />

        {/* Some pages use the full viewport width — store, app detail,
            Settings (esp. the API tab with embedded Swagger), and Help
            portal. Everything else keeps the classic centered white card. */}
        {(() => {
          const path = location.pathname;
          const wide =
            path === "/apps/store" ||
            path.startsWith("/apps/") ||
            path === "/settings" ||
            path.startsWith("/help");
          // Page surface colors follow the resolved theme. Wide pages
          // sit on the page-bg directly; narrow pages get a card-like
          // surface against the page background.
          const wideBg = pageBg;
          const cardBg = surface;
          return (
            <Content
              style={{
                margin: wide ? 0 : 24,
                padding: wide ? "24px 32px" : 0,
                minWidth: 0,
                overflow: "auto",
                background: wide ? wideBg : "transparent",
              }}
            >
              <div
                style={{
                  padding: wide ? 0 : 24,
                  minHeight: 360,
                  background: wide ? "transparent" : cardBg,
                  borderRadius: wide ? 0 : 8,
                  minWidth: 0,
                }}
              >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
              </div>
            </Content>
          );
        })()}
      </Layout>
    </Layout>
  );
}


/**
 * Theme switcher for the top bar. Matches the visual weight of its
 * neighbours (Ассистент / Выйти) — icon + short label, same height
 * and text color. Dropdown with three options: Light, Dark, System.
 */
function ThemeSwitcher() {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const setMode = useThemeStore((s) => s.setMode);

  const glyphFor = (m: ThemeMode | "light" | "dark") => {
    if (m === "light") return <SunGlyph />;
    if (m === "dark") return <MoonGlyph />;
    return <DesktopOutlined />;
  };
  const triggerGlyph = mode === "system" ? glyphFor("system") : glyphFor(resolved);
  const triggerLabel =
    mode === "system"
      ? "Тема: авто"
      : mode === "dark"
      ? "Тёмная"
      : "Светлая";

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        selectedKeys: [mode],
        onClick: ({ key }) => setMode(key as ThemeMode),
        items: [
          { key: "light", icon: glyphFor("light"), label: "Светлая" },
          { key: "dark", icon: glyphFor("dark"), label: "Тёмная" },
          { key: "system", icon: glyphFor("system"), label: "Как в системе" },
        ],
      }}
    >
      <a
        style={{
          color: "#999",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          lineHeight: "48px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#EE3424")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
      >
        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 14 }}>
          {triggerGlyph}
        </span>
        {triggerLabel}
      </a>
    </Dropdown>
  );
}

/** Inline sun — Ant Design's ``SunOutlined`` isn't present in all
 *  versions we support, so we ship our own for safety. */
function SunGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="3.2" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <line x1="8" y1="1.5" x2="8" y2="3.2" />
        <line x1="8" y1="12.8" x2="8" y2="14.5" />
        <line x1="1.5" y1="8" x2="3.2" y2="8" />
        <line x1="12.8" y1="8" x2="14.5" y2="8" />
        <line x1="3.3" y1="3.3" x2="4.6" y2="4.6" />
        <line x1="11.4" y1="11.4" x2="12.7" y2="12.7" />
        <line x1="12.7" y1="3.3" x2="11.4" y2="4.6" />
        <line x1="4.6" y1="11.4" x2="3.3" y2="12.7" />
      </g>
    </svg>
  );
}

/** Simple moon glyph — Ant Design doesn't ship a moon icon in the core
 *  set. Inline SVG keeps us dependency-free. */
function MoonGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden>
      <path d="M11 13.5a7.5 7.5 0 0 1-7.4-8.9 6 6 0 1 0 7.83 7.83c-.14.04-.29.07-.43.07z"/>
    </svg>
  );
}


/**
 * Sidebar avatar — shows the admin-uploaded image if there is one,
 * otherwise the first letter of the email on a brand-red circle.
 * Single source of truth so both collapsed and expanded sidebar modes
 * stay in sync.
 */
function UserAvatar({ size }: { size: "small" | number }) {
  const user = useAuthStore((s) => s.user);
  const url = avatarAssetUrl(user?.avatar_path);
  const initial = (user?.email?.[0] ?? "M").toUpperCase();
  return (
    <Avatar
      size={size}
      src={url ?? undefined}
      icon={!url && <UserOutlined />}
      style={{
        background: "#EE3424",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {!url && initial}
    </Avatar>
  );
}


/** Footer version line. Reads "Версия X от DD.MM.YYYY", clickable —
 *  click opens the «Что нового» modal. */
function VersionFooter() {
  const { open } = useWhatsNew();
  // 2026.04.20 → 20.04.2026 (human-readable, matches the rest of the UI).
  const ruDate = APP_BUILD.split(".").reverse().join(".");
  return (
    <div
      onClick={open}
      style={{
        color: "#555",
        fontSize: 10,
        marginTop: 12,
        paddingTop: 8,
        borderTop: "1px solid #1a1a1a",
        cursor: "pointer",
        transition: "color .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
    >
      Версия {APP_VERSION} от {ruDate}
    </div>
  );
}
