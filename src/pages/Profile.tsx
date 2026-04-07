import { Card, Descriptions, Tag, Typography } from "antd";

import { useAuthStore } from "@/store/auth";
import type { UserRole } from "@/types";

const ROLE_COLOR: Record<UserRole, string> = {
  viewer: "default",
  tester: "blue",
  admin: "red",
};

export function Profile() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Profile
      </Typography.Title>

      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color={ROLE_COLOR[user.role]}>{user.role}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="User ID">
            <Typography.Text code>{user.id}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Active">
            {user.is_active ? "Yes" : "No"}
          </Descriptions.Item>
          <Descriptions.Item label="Verified">
            {user.is_verified ? "Yes" : "No"}
          </Descriptions.Item>
          <Descriptions.Item label="Must change password">
            {user.must_change_password ? "Yes" : "No"}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  );
}
