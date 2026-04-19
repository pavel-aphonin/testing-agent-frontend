import {
  ApiOutlined,
  AppstoreOutlined,
  BookOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MessageOutlined,
  MobileOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Layout, Menu, Space, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { AssistantDrawer } from "@/components/AssistantDrawer";
import { NotificationsBell } from "@/components/NotificationsBell";
import { WorkerStatusBadge } from "@/components/WorkerStatusBadge";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useAuthStore } from "@/store/auth";

const { Header, Sider, Content } = Layout;

const SIDER_WIDTH = 240;
const APP_VERSION = "0.3.0";
const APP_BUILD = "2026.04.19";

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Permission set for the current user
  const perms = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions],
  );

  const hasPerm = (p: string) => perms.has(p);

  if (!user) return null;

  // ── Build sidebar items based on permissions ────────────────────────────
  const items: { key: string; icon: React.ReactNode; label: React.ReactNode }[] = [];

  // Runs — everyone who can view
  if (hasPerm("runs.view")) {
    items.push({
      key: "/runs",
      icon: <ExperimentOutlined />,
      label: <Link to="/runs">{t("nav.runs")}</Link>,
    });
  }

  // Settings
  if (hasPerm("settings.view")) {
    items.push({
      key: "/settings",
      icon: <SettingOutlined />,
      label: <Link to="/settings">{t("nav.settings")}</Link>,
    });
  }

  // Profile — always available
  items.push({
    key: "/profile",
    icon: <UserOutlined />,
    label: <Link to="/profile">{t("nav.profile")}</Link>,
  });

  // Workspace members — always available (any member can view)
  items.push({
    key: "/workspace/members",
    icon: <AppstoreOutlined />,
    label: <Link to="/workspace/members">Участники пространства</Link>,
  });
  items.push({
    key: "/workspace/dictionaries",
    icon: <BookOutlined />,
    label: <Link to="/workspace/dictionaries">Справочники пространства</Link>,
  });

  // Test data
  if (hasPerm("test_data.view")) {
    items.push({
      key: "/test-data",
      icon: <DatabaseOutlined />,
      label: <Link to="/test-data">{t("nav.testData")}</Link>,
    });
  }

  // Devices
  if (hasPerm("devices.view")) {
    items.push({
      key: "/admin/devices",
      icon: <MobileOutlined />,
      label: <Link to="/admin/devices">{t("adminDevices.title")}</Link>,
    });
  }

  // LLM Models
  if (hasPerm("models.view")) {
    items.push({
      key: "/admin/models",
      icon: <ApiOutlined />,
      label: <Link to="/admin/models">{t("nav.llmModels")}</Link>,
    });
  }

  // Knowledge base
  if (hasPerm("knowledge.view")) {
    items.push({
      key: "/admin/knowledge",
      icon: <BookOutlined />,
      label: <Link to="/admin/knowledge">{t("nav.knowledgeBase")}</Link>,
    });
  }

  // Scenarios
  if (hasPerm("scenarios.view")) {
    items.push({
      key: "/admin/scenarios",
      icon: <PlayCircleOutlined />,
      label: <Link to="/admin/scenarios">{t("nav.scenarios")}</Link>,
    });
  }

  // Users
  if (hasPerm("users.view")) {
    items.push({
      key: "/admin/users",
      icon: <TeamOutlined />,
      label: <Link to="/admin/users">{t("nav.users")}</Link>,
    });
  }

  // Dictionaries (Справочники)
  if (hasPerm("dictionaries.view")) {
    items.push({
      key: "/dictionaries",
      icon: <FileTextOutlined />,
      label: <Link to="/dictionaries">{t("nav.dictionaries")}</Link>,
    });
  }

  // Help — always available
  items.push({
    key: "/help",
    icon: <QuestionCircleOutlined />,
    label: <Link to="/help">Справка</Link>,
  });

  const selectedKey =
    items
      .map((i) => i.key)
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? "/runs";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={SIDER_WIDTH}
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
          {/* Logo / Title */}
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
              cursor: "pointer",
              flexShrink: 0,
            }}
            onClick={() => setCollapsed(!collapsed)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <style>{`
              @keyframes flipLogo {
                0%, 40% { transform: rotateY(0deg); }
                50%, 90% { transform: rotateY(180deg); }
                100% { transform: rotateY(360deg); }
              }
            `}</style>
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
                {/* Front: М (Марков) */}
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
                {/* Back: Alfa-Bank logo (A with underline) */}
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
            {!collapsed && t("auth.loginTitle")}
          </span>
          </div>

          {/* Main navigation — grows to fill space */}
          <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin" }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={items}
              style={{ borderRight: 0 }}
            />
          </div>

          {/* User info pinned to bottom */}
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
                  <Avatar
                    size="small"
                    icon={<UserOutlined />}
                    style={{ background: "#EE3424" }}
                  />
                </div>
              </Tooltip>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Avatar
                    size="small"
                    icon={<UserOutlined />}
                    style={{ background: "#EE3424", flexShrink: 0 }}
                  />
                  <div style={{ overflow: "hidden", lineHeight: 1.3 }}>
                    <Typography.Text
                      style={{ color: "#fff", fontSize: 12, display: "block" }}
                      ellipsis
                    >
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
      </Sider>

      <Layout style={{ minWidth: 0 }}>
        {/* Header — worker status, assistant, logout */}
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
                transition: "color 0.2s",
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
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#EE3424")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
          >
            <LogoutOutlined /> {t("auth.signOut")}
          </a>
          </Space>
        </Header>

        <AssistantDrawer
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
        />

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
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
