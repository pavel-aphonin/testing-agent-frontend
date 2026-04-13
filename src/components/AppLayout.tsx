import {
  ApiOutlined,
  BookOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  MobileOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Layout, Menu, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/store/auth";

const { Header, Sider, Content } = Layout;

const SIDER_WIDTH = 240;
const APP_VERSION = "0.2.0";
const APP_BUILD = "2026.04.12";

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const items = [
    {
      key: "/runs",
      icon: <ExperimentOutlined />,
      label: <Link to="/runs">{t("nav.runs")}</Link>,
    },
    {
      key: "/settings",
      icon: <SettingOutlined />,
      label: <Link to="/settings">{t("nav.settings")}</Link>,
    },
    {
      key: "/profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">{t("nav.profile")}</Link>,
    },
  ];

  const isTesterOrAdmin = user.role === "tester" || user.role === "admin";

  if (isTesterOrAdmin) {
    items.push({
      key: "/test-data",
      icon: <DatabaseOutlined />,
      label: <Link to="/test-data">{t("nav.testData")}</Link>,
    });
  }

  if (isAdmin) {
    items.push({
      key: "/admin/devices",
      icon: <MobileOutlined />,
      label: <Link to="/admin/devices">{t("adminDevices.title")}</Link>,
    });
    items.push({
      key: "/admin/models",
      icon: <ApiOutlined />,
      label: <Link to="/admin/models">{t("nav.llmModels")}</Link>,
    });
    items.push({
      key: "/admin/knowledge",
      icon: <BookOutlined />,
      label: <Link to="/admin/knowledge">{t("nav.knowledgeBase")}</Link>,
    });
    items.push({
      key: "/admin/scenarios",
      icon: <PlayCircleOutlined />,
      label: <Link to="/admin/scenarios">{t("nav.scenarios")}</Link>,
    });
    items.push({
      key: "/admin/users",
      icon: <TeamOutlined />,
      label: <Link to="/admin/users">{t("nav.users")}</Link>,
    });
  }

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
              <Tooltip title={`${user.email}\n${t(`roles.${user.role}`)}`} placement="right">
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
                      {t(`roles.${user.role}`)}
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
        {/* Header — only logout button */}
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            borderBottom: "1px solid #f0f0f0",
            height: 48,
            lineHeight: "48px",
          }}
        >
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
        </Header>

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
