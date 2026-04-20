import {
  ApiOutlined,
  AppstoreOutlined,
  BookOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  MobileOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Layout, Menu, Space, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { AssistantDrawer } from "@/components/AssistantDrawer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationsBell } from "@/components/NotificationsBell";
import { WorkerStatusBadge } from "@/components/WorkerStatusBadge";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useAuthStore } from "@/store/auth";

const { Header, Sider, Content } = Layout;

const APP_VERSION = "0.4.0";
const APP_BUILD = "2026.04.20";

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
    try {
      const raw = localStorage.getItem("ta-sider-groups");
      return raw ? JSON.parse(raw) : ["sys", "ws"];
    } catch {
      return ["sys", "ws"];
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

  const perms = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions],
  );
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
    icon: <AppstoreOutlined />,
    label: <Link to="/workspace/members">Участники пространства</Link>,
  });

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

  // Always-visible footer items
  const footerItems: Item[] = [
    {
      key: "/profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">{t("nav.profile")}</Link>,
    },
    {
      key: "/help",
      icon: <QuestionCircleOutlined />,
      label: <Link to="/help">Справка</Link>,
    },
  ];

  // ── Build menu structure ────────────────────────────────────────────────
  const menuItems: MenuProps["items"] = [];
  if (wsItems.length > 0) {
    menuItems.push({
      key: "ws",
      label: "Рабочее пространство",
      type: "group",
      children: wsItems,
    });
  }
  if (sysItems.length > 0) {
    menuItems.push({
      key: "sys",
      label: "Система",
      type: "group",
      children: sysItems,
    });
  }
  menuItems.push({ type: "divider" });
  for (const it of footerItems) {
    menuItems.push(it);
  }

  // For collapsed mode use plain items (no groups, since labels are hidden)
  const collapsedItems: MenuProps["items"] = [
    ...wsItems,
    { type: "divider" as const },
    ...sysItems,
    { type: "divider" as const },
    ...footerItems,
  ];

  const allKeys = [...wsItems, ...sysItems, ...footerItems].map((i) => i.key);
  const selectedKey =
    allKeys
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? "/runs";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
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
          background: "#0B0B0B",
          display: "flex",
          flexDirection: "column",
        }}
        trigger={null}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logo */}
          <div
            style={{
              color: "#fff",
              padding: collapsed ? "20px 8px 16px" : "20px 16px 16px",
              fontSize: collapsed ? 14 : 20,
              fontWeight: 700,
              letterSpacing: 0.3,
              borderBottom: "2px solid #EE3424",
              marginBottom: 4,
              textAlign: collapsed ? "center" : "left",
              whiteSpace: "nowrap",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              gap: 8,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  background: "#EE3424",
                  borderRadius: 8,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                М
              </span>
              {!collapsed && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t("auth.loginTitle")}
                </span>
              )}
            </span>
            <Tooltip title={collapsed ? "Развернуть" : "Свернуть"} placement="right">
              <a
                onClick={() => setCollapsed(!collapsed)}
                style={{ color: "#888", fontSize: 14, cursor: "pointer", flexShrink: 0 }}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </a>
            </Tooltip>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin" }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={collapsed ? collapsedItems : menuItems}
              defaultOpenKeys={openGroups}
              onOpenChange={setOpenGroups}
              style={{ borderRight: 0 }}
            />
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
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: "#EE3424" }} />
                </div>
              </Tooltip>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: "#EE3424", flexShrink: 0 }} />
                  <div style={{ overflow: "hidden", lineHeight: 1.3 }}>
                    <Typography.Text style={{ color: "#fff", fontSize: 12, display: "block" }} ellipsis>
                      {user.email}
                    </Typography.Text>
                    <Typography.Text style={{ color: "#888", fontSize: 11 }}>
                      {user.role_name || t(`roles.${user.role}`)}
                    </Typography.Text>
                  </div>
                </div>
                <div style={{ color: "#555", fontSize: 10, marginTop: 12, paddingTop: 8, borderTop: "1px solid #1a1a1a" }}>
                  v{APP_VERSION} · {APP_BUILD}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Resize handle (only when expanded) */}
        {!collapsed && (
          <div
            onMouseDown={startResize}
            style={{
              position: "absolute",
              top: 0,
              right: -2,
              width: 4,
              height: "100%",
              cursor: "col-resize",
              zIndex: 100,
              background: "transparent",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#EE342488")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          />
        )}
      </Sider>

      <Layout style={{ minWidth: 0, marginLeft: 0 }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            height: 48,
            lineHeight: "48px",
          }}
        >
          <WorkspaceSwitcher />
          <Space size={24}>
            <WorkerStatusBadge />
            <NotificationsBell />
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

        <Content style={{ margin: 24, minWidth: 0, overflow: "auto" }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: "#fff",
              borderRadius: 8,
              minWidth: 0,
            }}
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
