import { CloudUploadOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { notify } from "@/utils/notify";

import {
  avatarAssetUrl,
  changeMyPassword,
  deleteMyAvatar,
  getMyProfile,
  uploadMyAvatar,
} from "@/api/profile";
import { getMySettings, updateMySettings } from "@/api/settings";
import { ThemeTokensEditor } from "@/components/ThemeTokensEditor";
import { ProfileMyApps } from "@/pages/ProfileMyApps";
import { useAuthStore } from "@/store/auth";
import type { ChangePasswordRequest, CurrentUser, ThemeTokens } from "@/types";

const ROLE_COLOR: Record<string, string> = {
  viewer: "default",
  tester: "blue",
  moderator: "purple",
  admin: "red",
};

export function Profile() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "general";

  if (!user) return null;

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {t("profile.title")}
      </Typography.Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={[
          {
            key: "general",
            label: "Общая информация",
            children: <GeneralTab />,
          },
          {
            key: "password",
            label: "Сменить пароль",
            children: <PasswordTab />,
          },
          {
            key: "avatar",
            label: "Аватар",
            children: <AvatarTab />,
          },
          {
            key: "nav",
            label: "Навигация",
            children: <NavigationTab />,
          },
          {
            key: "theme",
            label: "Моя тема",
            children: <MyThemeTab />,
          },
          {
            key: "my-apps",
            label: "Мои приложения",
            children: <ProfileMyApps />,
          },
        ]}
      />
    </>
  );
}

function GeneralTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user)!;
  return (
    <Card>
      <Descriptions column={1} bordered>
        <Descriptions.Item label={t("profile.email")}>{user.email}</Descriptions.Item>
        <Descriptions.Item label={t("profile.role")}>
          <Tag color={ROLE_COLOR[user.role_code || user.role] ?? "default"}>
            {user.role_name || t(`roles.${user.role}`)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Permissions">
          {user.permissions?.length ?? 0}
        </Descriptions.Item>
      </Descriptions>
      {user.must_change_password && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="Требуется сменить пароль на вкладке «Сменить пароль»"
        />
      )}
    </Card>
  );
}

function PasswordTab() {
  const { t } = useTranslation();
  const [form] = Form.useForm<ChangePasswordRequest & { confirm_password: string }>();

  const mutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      notify.success(t("profile.passwordChanged"));
      form.resetFields();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("profile.passwordChangeFailed");
      notify.error(detail);
    },
  });

  return (
    <Card style={{ maxWidth: 480 }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) =>
          mutation.mutate({
            current_password: values.current_password,
            new_password: values.new_password,
          })
        }
      >
        <Form.Item
          name="current_password"
          label={t("profile.currentPassword")}
          rules={[{ required: true, message: t("profile.currentPasswordRequired") }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label={t("profile.newPassword")}
          rules={[{ required: true, message: t("profile.newPasswordRequired") }, { min: 8 }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label={t("profile.confirmPassword")}
          dependencies={["new_password"]}
          rules={[
            { required: true, message: t("profile.newPasswordRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("profile.passwordsDontMatch")));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            {t("profile.changePassword")}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}


/**
 * Per-user theme overrides. Everything configured here is applied on
 * top of the admin's system-level branding — so if the admin set a
 * hot pink for "success" that looks awful on this user's monitor, they
 * can pick their own shade without affecting anyone else.
 */
function MyThemeTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
  });
  const m = useMutation({
    mutationFn: (tokens: ThemeTokens | null) =>
      updateMySettings({ theme_overrides: tokens }),
    onSuccess: () => {
      notify.success("Ваша тема сохранена");
      // Invalidate both my-settings (source of truth) and
      // system-branding (unrelated but tokens are composed together).
      qc.invalidateQueries({ queryKey: ["my-settings"] });
    },
    onError: (e: any) =>
      notify.error(e?.response?.data?.detail ?? "Не удалось сохранить"),
  });
  return (
    <Card loading={q.isLoading}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Эти настройки видны только вам"
        description={
          <>
            Меняют оформление именно у вас в браузере. Накладываются поверх
            палитры, заданной администратором: если какой-то из стандартных
            оттенков напрягает на вашем мониторе — подберите свой. Остальные
            пользователи продолжат видеть общую корпоративную палитру.
          </>
        }
      />
      <ThemeTokensEditor
        value={q.data?.theme_overrides ?? null}
        saving={m.isPending}
        onSave={(t) => m.mutate(t)}
        allowFontSize
        labels={{
          intro: undefined,
          saveLabel: "Сохранить мою тему",
          resetAllLabel: "Вернуть корпоративную",
        }}
      />
    </Card>
  );
}


/**
 * Avatar management. Upload → the file lands in ``avatars/`` under
 * the shared uploads dir and the URL swaps instantly across the app
 * (sidebar, comment threads, wherever we render <Avatar>). Delete
 * falls back to the default red circle with the first email letter.
 */
function AvatarTab() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const profileQ = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  const syncMe = (updated: CurrentUser) => {
    // Update the auth store so the sidebar avatar (which reads from it)
    // refreshes without a round-trip via fetchMe().
    setUser({ ...(user ?? ({} as CurrentUser)), ...updated });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const uploadM = useMutation({
    mutationFn: uploadMyAvatar,
    onSuccess: (u) => {
      notify.success("Аватар обновлён");
      syncMe(u);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const removeM = useMutation({
    mutationFn: deleteMyAvatar,
    onSuccess: (u) => {
      notify.success("Аватар удалён");
      syncMe(u);
    },
  });

  if (profileQ.isLoading || !profileQ.data) {
    return <Card><Spin /></Card>;
  }
  const p = profileQ.data;
  const avatarUrl = avatarAssetUrl(p.avatar_path);
  const initial = (p.email?.[0] ?? "M").toUpperCase();

  return (
    <Card>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Ваш аватар"
        description={
          <>
            PNG, JPG, WebP или GIF, до 2 МБ. Лучше всего — квадратная картинка.
            Видна вам в боковой панели и всем пользователям вашего пространства
            — в комментариях, отзывах, журналах действий.
          </>
        }
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "20px 24px",
          border: "1px solid var(--ta-border, #ececec)",
          borderRadius: 12,
          maxWidth: 560,
        }}
      >
        <Avatar
          size={96}
          src={avatarUrl ?? undefined}
          icon={!avatarUrl && <UserOutlined />}
          style={{
            background: "#EE3424",
            color: "#fff",
            fontSize: 40,
            fontWeight: 600,
          }}
        >
          {!avatarUrl && initial}
        </Avatar>
        <Space direction="vertical" size={6}>
          <Typography.Text strong>{p.email}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {avatarUrl ? "Собственный аватар" : "Стандартный круг с буквой"}
          </Typography.Text>
          <Space style={{ marginTop: 6 }}>
            <Upload
              accept=".png,.jpg,.jpeg,.webp,.gif"
              showUploadList={false}
              beforeUpload={(f) => {
                uploadM.mutate(f);
                return false;
              }}
            >
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={uploadM.isPending}
              >
                {avatarUrl ? "Заменить" : "Загрузить"}
              </Button>
            </Upload>
            {avatarUrl && (
              <Popconfirm
                title="Удалить аватар?"
                onConfirm={() => removeM.mutate()}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
              >
                <Button danger loading={removeM.isPending}>
                  Удалить
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      </div>
    </Card>
  );
}


/**
 * Per-user sidebar navigation — hide built-in menu items that you
 * personally never use. Think "I don't ever touch the LLM Models page,
 * it just takes space in my sidebar". Affects only this user; admins
 * of other workspaces still see the full menu.
 *
 * The list of available items is derived from the permissions the
 * user actually has (no sense showing "Users" checkbox to a viewer
 * who wouldn't see it anyway).
 */
function NavigationTab() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const perms = new Set(user?.permissions ?? []);

  const q = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
  });
  const m = useMutation({
    mutationFn: (hidden: string[]) =>
      updateMySettings({ hidden_nav_items: hidden }),
    onSuccess: (fresh) => {
      notify.success("Навигация сохранена");
      // Seed the cache with the fresh row so AppLayout's ``mySettings``
      // query updates without a round-trip — sidebar hides/shows the
      // toggled item instantly.
      qc.setQueryData(["my-settings"], fresh);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  // The catalog of hidable routes — keep in sync with AppLayout's menu.
  // Labels match what users see in the sidebar so the checkboxes feel
  // native. ``perm`` gates visibility of the checkbox itself: if you
  // don't have the permission, the item is hidden from the sidebar
  // already and there's no point in the toggle.
  const ITEMS: { key: string; label: string; perm?: string }[] = [
    { key: "/runs",               label: "Запуски" },
    { key: "/scenarios",          label: "Сценарии", perm: "scenarios.view" },
    { key: "/test-data",          label: "Тестовые данные", perm: "test_data.view" },
    { key: "/knowledge",          label: "База знаний", perm: "knowledge.view" },
    { key: "/workspace/members",  label: "Участники пространства" },
    { key: "/workspace/apps",     label: "Приложения пространства" },
    { key: "/settings",           label: "Настройки" },
    { key: "/devices",            label: "Устройства", perm: "devices.view" },
    { key: "/models",             label: "LLM модели", perm: "models.view" },
    { key: "/admin/users",        label: "Пользователи", perm: "users.view" },
    { key: "/dictionaries",       label: "Справочники", perm: "dictionaries.view" },
    { key: "/apps/store",         label: "Магазин приложений" },
    { key: "/admin/apps",         label: "Модерация приложений", perm: "apps.moderate" },
    { key: "/admin/feedback",     label: "Обращения", perm: "users.view" },
    { key: "/help",               label: "Справка" },
  ];

  const hidden = new Set(q.data?.hidden_nav_items ?? []);

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(hidden);
    if (checked) next.delete(key); else next.add(key);
    m.mutate(Array.from(next));
  };

  return (
    <Card loading={q.isLoading}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Скрыть лишние пункты бокового меню"
        description={
          <>
            Снимите галочку — пункт пропадёт из вашего сайдбара. Настройка
            применяется только к вам. Права доступа не меняются: скрытые
            разделы остаются доступны по прямой ссылке.
          </>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 8,
        }}
      >
        {ITEMS.filter((it) => !it.perm || perms.has(it.perm)).map((it) => {
          const visible = !hidden.has(it.key);
          return (
            <Checkbox
              key={it.key}
              checked={visible}
              onChange={(e) => toggle(it.key, e.target.checked)}
            >
              {it.label}
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                {it.key}
              </Typography.Text>
            </Checkbox>
          );
        })}
      </div>
    </Card>
  );
}
