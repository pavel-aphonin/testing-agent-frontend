import { useQuery } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import ruRU from "antd/locale/ru_RU";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";

import { fetchMe } from "@/api/auth";
import { getMySettings } from "@/api/settings";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminDevices } from "@/pages/AdminDevices";
import { AdminKnowledge } from "@/pages/AdminKnowledge";
import { AdminModels } from "@/pages/AdminModels";
import { AdminScenarios } from "@/pages/AdminScenarios";
import { AdminUsers } from "@/pages/AdminUsers";
import { Dictionaries } from "@/pages/Dictionaries";
import { WorkspaceDictionaries } from "@/pages/WorkspaceDictionaries";
import { WorkspaceMembers } from "@/pages/WorkspaceMembers";
import { HelpPage } from "@/pages/Help";
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

  // Refresh user data (permissions, role) on every page load so that
  // permission changes by admins take effect without re-login.
  const setUser = useAuthStore((s) => s.setUser);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: isAuthed,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  // Once the user is logged in, fetch their saved language and apply it.
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
          <Route path="/help" element={<HelpPage />} />
          <Route
            path="/test-data"
            element={
              <ProtectedRoute requirePermission="test_data.view">
                <TestData />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requirePermission="users.view">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/models"
            element={
              <ProtectedRoute requirePermission="models.view">
                <AdminModels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/devices"
            element={
              <ProtectedRoute requirePermission="devices.view">
                <AdminDevices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/knowledge"
            element={
              <ProtectedRoute requirePermission="knowledge.view">
                <AdminKnowledge />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/scenarios"
            element={
              <ProtectedRoute requirePermission="scenarios.view">
                <AdminScenarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dictionaries/*"
            element={
              <ProtectedRoute requirePermission="dictionaries.view">
                <Dictionaries />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/members"
            element={<WorkspaceMembers />}
          />
          <Route
            path="/workspace/dictionaries"
            element={<WorkspaceDictionaries />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/runs" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
