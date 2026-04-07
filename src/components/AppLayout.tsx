import {
  ExperimentOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Layout, Menu, Typography } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/store/auth";

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const items = [
    {
      key: "/runs",
      icon: <ExperimentOutlined />,
      label: <Link to="/runs">Runs</Link>,
    },
    {
      key: "/profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">Profile</Link>,
    },
  ];

  if (isAdmin) {
    items.push({
      key: "/admin/users",
      icon: <TeamOutlined />,
      label: <Link to="/admin/users">Users</Link>,
    });
  }

  // Pick the menu item whose key is the longest prefix of the current path.
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
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          overflow: "auto",
          height: "100vh",
          position: "sticky",
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          scrollbarWidth: "thin",
          background: "#001529",
        }}
      >
        <div
          style={{
            color: "#fff",
            padding: "20px 16px",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          Testing Agent
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar icon={<UserOutlined />} />
            <div style={{ lineHeight: 1.2 }}>
              <Typography.Text strong>{user.email}</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {user.role}
              </Typography.Text>
            </div>
            <a
              onClick={handleLogout}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <LogoutOutlined /> Sign out
            </a>
          </div>
        </Header>

        <Content style={{ margin: 24 }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: "#fff",
              borderRadius: 8,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
