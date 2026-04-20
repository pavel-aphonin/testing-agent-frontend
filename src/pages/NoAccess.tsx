import { LockOutlined } from "@ant-design/icons";
import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

/** Shown when the user navigates to a page they don't have permission for. */
export function NoAccess() {
  const nav = useNavigate();
  return (
    <Result
      status="403"
      icon={<LockOutlined style={{ color: "#EE3424" }} />}
      title="Нет доступа"
      subTitle="У вас нет прав на просмотр этой страницы. Обратитесь к администратору."
      extra={
        <Button type="primary" onClick={() => nav("/runs")}>
          К списку запусков
        </Button>
      }
    />
  );
}
