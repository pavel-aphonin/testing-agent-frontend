import { useQuery } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import ruRU from "antd/locale/ru_RU";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";

import { getMySettings } from "@/api/settings";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminDevices } from "@/pages/AdminDevices";
import { AdminKnowledge } from "@/pages/AdminKnowledge";
import { AdminModels } from "@/pages/AdminModels";
import { AdminScenarios } from "@/pages/AdminScenarios";
import { AdminUsers } from "@/pages/AdminUsers";
import { Login } from "@/pages/Login";
import { Profile } from "@/pages/Profile";
import { RunProgress } from "@/pages/RunProgress";
import { RunResults } from "@/pages/RunResults";
import { Runs } from "@/pages/Runs";
import { Settings } from "@/pages/Settings";
import { TestData } from "@/pages/TestData";
import { useAuthStore } from "@/store/auth";

const ANTD_LOCALES = { en: enUS, ru: ruRU } as const;

export default function App() {
  const { i18n } = useTranslation();
  const isAuthed = useAuthStore((s) => Boolean(s.token));

  // Once the user is logged in, fetch their saved language and apply it.
  // Anonymous users keep whatever the browser detector picked. We only
  // fetch when authed so the request doesn't hit /api/settings on the
  // login screen and 401 in the network tab.
  const settingsQuery = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    enabled: isAuthed,
    staleTime: 60_000,
  });

  useEffect(() => {
    const lang = settingsQuery.data?.language;
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }, [settingsQuery.data?.language, i18n]);

  const antdLocale =
    ANTD_LOCALES[i18n.language as keyof typeof ANTD_LOCALES] ?? enUS;

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: "#EE3424",
          colorError: "#EE3424",
          borderRadius: 6,
        },
        components: {
          Menu: {
            darkItemBg: "#0B0B0B",
            darkSubMenuItemBg: "#0B0B0B",
            darkItemSelectedBg: "#EE3424",
          },
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
          <Route path="/runs/:id/progress" element={<RunProgress />} />
          <Route path="/runs/:id/results" element={<RunResults />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/test-data"
            element={
              <ProtectedRoute requireRole="tester">
                <TestData />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/models"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminModels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/devices"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminDevices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/knowledge"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminKnowledge />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/scenarios"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminScenarios />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/runs" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
