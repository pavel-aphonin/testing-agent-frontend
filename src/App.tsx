import { ConfigProvider } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminUsers } from "@/pages/AdminUsers";
import { Login } from "@/pages/Login";
import { Profile } from "@/pages/Profile";
import { Runs } from "@/pages/Runs";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
        },
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/runs" element={<Runs />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/runs" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
