import { useQuery } from "@tanstack/react-query";
import { ConfigProvider, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import ruRU from "antd/locale/ru_RU";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";

import { fetchMe } from "@/api/auth";
import { getMySettings } from "@/api/settings";
import { AppLayout } from "@/components/AppLayout";
import { BrandingSync } from "@/components/BrandingSync";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WhatsNewProvider } from "@/components/WhatsNew";
import { composeTokens, useBranding, useUserThemeOverrides } from "@/hooks/useBranding";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { AdminDevices } from "@/pages/AdminDevices";
import { AdminKnowledge } from "@/pages/AdminKnowledge";
import { AdminModels } from "@/pages/AdminModels";
import { AdminScenarios, AdminScenarioEdit } from "@/pages/AdminScenarios";
import { AdminUsers } from "@/pages/AdminUsers";
import { Dictionaries } from "@/pages/Dictionaries";
import { AdminApps } from "@/pages/AdminApps";
import { AppDetail } from "@/pages/AppDetail";
import { AppsStore } from "@/pages/AppsStore";
import { WorkspaceApps } from "@/pages/WorkspaceApps";
import { WorkspaceDictionaries } from "@/pages/WorkspaceDictionaries";
import { WorkspaceMembers } from "@/pages/WorkspaceMembers";
import { DashboardPage } from "@/pages/DashboardPage";
import { WidgetPackagesPage } from "@/pages/WidgetPackagesPage";
import { WidgetTemplatesPage } from "@/pages/WidgetTemplatesPage";
import { FeedbackInbox } from "@/pages/FeedbackInbox";
import { HelpPage } from "@/pages/Help";
import { WhatsNewPage } from "@/pages/WhatsNewPage";
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

  const resolvedTheme = useResolvedTheme();
  const branding = useBranding();
  const userOverrides = useUserThemeOverrides();
  const isDark = resolvedTheme === "dark";

  // Final token set = defaults → system branding → personal overrides.
  const tokens = composeTokens(resolvedTheme, branding.systemTokens, userOverrides);

  // Sync body background + sidebar CSS variables so non-AntD elements
  // (sidebar, layout backgrounds, inline cards) pick up the right
  // theme colors automatically. CSS vars are read by AppLayout.
  useEffect(() => {
    const bg = tokens.antd.colorBgLayout as string;
    document.body.style.background = bg;
    document.body.dataset.theme = resolvedTheme;
    document.documentElement.style.setProperty("--ta-sidebar-bg", tokens.sidebar.bg);
    document.documentElement.style.setProperty("--ta-sidebar-hover", tokens.sidebar.itemHoverBg);
    document.documentElement.style.setProperty("--ta-sidebar-active", tokens.sidebar.itemSelectedBg);
  }, [resolvedTheme, tokens.antd.colorBgLayout, tokens.sidebar.bg, tokens.sidebar.itemHoverBg, tokens.sidebar.itemSelectedBg]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: tokens.antd,
        components: {
          Menu: {
            darkItemBg: tokens.sidebar.bg,
            darkSubMenuItemBg: tokens.sidebar.bg,
            darkItemHoverBg: tokens.sidebar.itemHoverBg,
            darkItemSelectedBg: tokens.sidebar.itemSelectedBg,
          },
        },
      }}
    >
      {/* Mounted once at the app root so <title> and favicon sync with
          branding on every route, including /login. */}
      <BrandingSync />
      {/* WhatsNewProvider owns the "Что нового" modal state. Mounted
          above <Routes> so the sidebar plaque, footer and any future
          callsite can call useWhatsNew().open() from anywhere. */}
      <WhatsNewProvider>
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:id" element={<DashboardPage />} />
          <Route path="/widget-templates" element={<WidgetTemplatesPage />} />
          <Route path="/widget-packages" element={<WidgetPackagesPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/help/:slug" element={<HelpPage />} />
          <Route path="/whatsnew/:version" element={<WhatsNewPage />} />
          <Route
            path="/admin/feedback"
            element={
              <ProtectedRoute requirePermission="users.view">
                <FeedbackInbox />
              </ProtectedRoute>
            }
          />
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
            path="/admin/scenarios/:id"
            element={
              <ProtectedRoute requirePermission="scenarios.view">
                <AdminScenarioEdit />
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
          <Route path="/apps/store" element={<AppsStore />} />
          <Route path="/apps/:id" element={<AppDetail />} />
          <Route path="/workspace/apps" element={<WorkspaceApps />} />
          <Route
            path="/admin/apps"
            element={
              <ProtectedRoute requirePermission="dictionaries.edit">
                <AdminApps />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </WhatsNewProvider>
    </ConfigProvider>
  );
}
