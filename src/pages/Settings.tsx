import {
  ApiOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  theme as antdTheme,
  Typography,
  Upload,
} from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  deleteBrandingFavicon,
  deleteBrandingLogo,
  deleteBrandingLogoBack,
  getBranding,
  patchBrandingTokens,
  patchBrandingNames,
  resetBranding,
  uploadBrandingFavicon,
  uploadBrandingLogo,
  uploadBrandingLogoBack,
  brandingAssetUrl,
} from "@/api/branding";
import { MarkovLogo } from "@/components/MarkovLogo";
import { ThemeTokensEditor } from "@/components/ThemeTokensEditor";
import { useAuthStore } from "@/store/auth";

import { notify } from "@/utils/notify";

import { listActiveModels } from "@/api/models";
import { getMySettings, updateMySettings } from "@/api/settings";
import type {
  AgentSettingsUpdate,
  GraphLibrary,
  Language,
  RunMode,
} from "@/types";

export function Settings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AgentSettingsUpdate>();
  const me = useAuthStore((s) => s.user);
  const isAdmin = Boolean(me && (me.permissions ?? []).includes("users.view"));

  const settingsQuery = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
  });

  const modelsQuery = useQuery({
    queryKey: ["public-models"],
    queryFn: listActiveModels,
  });

  // Hybrid removed from the "default mode" picker. It currently
  // aliases AI in the worker — see explorer/modes.py docstring —
  // so listing it as a third option would mislead users into
  // expecting cached-priors + PUCT behaviour they wouldn't get.
  const modeOptions: { value: RunMode; label: string }[] = [
    { value: "mc", label: t("newRunModal.modes.mc") },
    { value: "ai", label: t("newRunModal.modes.ai") },
  ];

  const graphLibOptions: { value: GraphLibrary; label: string }[] = [
    { value: "react-flow", label: t("settings.graphLibraries.react-flow") },
    { value: "cytoscape", label: t("settings.graphLibraries.cytoscape") },
    { value: "vis-network", label: t("settings.graphLibraries.vis-network") },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: "en", label: t("settings.languages.en") },
    { value: "ru", label: t("settings.languages.ru") },
  ];

  const modelRoleOptions = (modelsQuery.data ?? []).map((m) => ({
    value: m.id,
    label: `${m.name} · ${m.family}`,
  }));

  // Hydrate the form once the settings load (and after a successful save).
  useEffect(() => {
    if (settingsQuery.data) {
      form.setFieldsValue({
        default_mode: settingsQuery.data.default_mode,
        default_llm_model_id: settingsQuery.data.default_llm_model_id,
        default_max_steps: settingsQuery.data.default_max_steps,
        c_puct: settingsQuery.data.c_puct,
        rollout_depth: settingsQuery.data.rollout_depth,
        graph_library: settingsQuery.data.graph_library,
        language: settingsQuery.data.language,
        vision_model_id: settingsQuery.data.vision_model_id,
        thinking_model_id: settingsQuery.data.thinking_model_id,
        instruct_model_id: settingsQuery.data.instruct_model_id,
        coder_model_id: settingsQuery.data.coder_model_id,
        rag_enabled: settingsQuery.data.rag_enabled,
      });
    }
  }, [settingsQuery.data, form]);

  const mutation = useMutation({
    mutationFn: updateMySettings,
    onSuccess: (saved) => {
      notify.success(t("settings.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-settings"] });
      // Apply the language change immediately, without waiting for a refresh.
      if (saved.language && saved.language !== i18n.language) {
        i18n.changeLanguage(saved.language);
      }
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("settings.saveFailed");
      notify.error(detail);
    },
  });

  // The API base for Swagger — same origin as the frontend in dev, or the
  // configured backend URL in prod. Docs are at /docs (FastAPI default).
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const swaggerUrl = `${apiBase || ""}/docs`;
  const redocUrl = `${apiBase || ""}/redoc`;

  const generalTab = (
    <>
      {modelsQuery.data && modelsQuery.data.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("settings.noModelsWarning")}
          description={t("settings.noModelsDescription")}
        />
      )}

      <Card loading={settingsQuery.isLoading}>
        {/* Tab-specific intro — the page header is now neutral, so
            the "what this tab does" explanation lives with the tab. */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Значения по умолчанию для модального окна «Новый запуск»"
          description="Эти параметры подставляются в форму создания запуска. На уже запущенные исследования не влияют."
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item name="default_mode" label={t("settings.defaultMode")}>
            <Select options={modeOptions} />
          </Form.Item>

          <Form.Item
            name="default_llm_model_id"
            label={t("settings.defaultModel")}
            extra={t("settings.defaultModelHelp")}
          >
            <Select
              allowClear
              loading={modelsQuery.isLoading}
              options={(modelsQuery.data ?? []).map((m) => ({
                value: m.id,
                label: `${m.name} · ${m.family} · ${m.quantization}`,
              }))}
              placeholder={t("settings.defaultModelPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="default_max_steps"
            label={t("settings.defaultMaxSteps")}
          >
            <InputNumber min={1} max={10000} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="c_puct"
            label={t("settings.cPuct")}
            extra={t("settings.cPuctHelp")}
          >
            <InputNumber
              min={0}
              max={10}
              step={0.1}
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item
            name="rollout_depth"
            label={t("settings.rolloutDepth")}
            extra={t("settings.rolloutDepthHelp")}
          >
            <InputNumber min={0} max={100} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="graph_library"
            label={t("settings.graphLibrary")}
            extra={t("settings.graphLibraryHelp")}
          >
            <Select options={graphLibOptions} />
          </Form.Item>

          <Divider />

          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t("settings.modelRoles")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t("settings.modelRolesHelp")}
          </Typography.Paragraph>

          <Form.Item
            name="vision_model_id"
            label={t("settings.visionModel")}
          >
            <Select
              allowClear
              loading={modelsQuery.isLoading}
              options={modelRoleOptions}
              placeholder={t("settings.defaultModelPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="thinking_model_id"
            label={t("settings.thinkingModel")}
          >
            <Select
              allowClear
              loading={modelsQuery.isLoading}
              options={modelRoleOptions}
              placeholder={t("settings.defaultModelPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="instruct_model_id"
            label={t("settings.instructModel")}
          >
            <Select
              allowClear
              loading={modelsQuery.isLoading}
              options={modelRoleOptions}
              placeholder={t("settings.defaultModelPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="coder_model_id"
            label={t("settings.coderModel")}
          >
            <Select
              allowClear
              loading={modelsQuery.isLoading}
              options={modelRoleOptions}
              placeholder={t("settings.defaultModelPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="rag_enabled"
            label={t("settings.ragEnabled")}
            extra={t("settings.ragEnabledHelp")}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item
            name="language"
            label={t("settings.language")}
            extra={t("settings.languageHelp")}
          >
            <Select options={languageOptions} />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={mutation.isPending}
            >
              {t("common.save")}
            </Button>
            <Button
              onClick={() =>
                settingsQuery.data &&
                form.setFieldsValue({
                  ...settingsQuery.data,
                  // Null → undefined so Form.setFieldsValue doesn't
                  // complain about the type mismatch with
                  // AgentSettingsUpdate (where every field is optional).
                  hidden_nav_items: settingsQuery.data.hidden_nav_items ?? undefined,
                })
              }
            >
              {t("common.reset")}
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  );

  // "API" tab — lives here rather than in the sidebar because most users
  // never need it, but when they do it's a power-user thing that fits
  // next to other account settings. Embedded iframe so you can actually
  // poke at endpoints without leaving the app.
  const apiTab = (
    <Card>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          REST API
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Все эндпоинты Markov Backend. Авторизация через JWT из вашей сессии — токен уже подставлен у Swagger при запросах с этой страницы. В интеграциях используйте Bearer-токен, полученный через <Typography.Text code>POST /auth/jwt/login</Typography.Text>.
        </Typography.Paragraph>
        <Space wrap>
          <Button
            type="primary"
            icon={<ApiOutlined />}
            href={swaggerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть Swagger UI
          </Button>
          <Button
            icon={<ApiOutlined />}
            href={redocUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть ReDoc
          </Button>
          <Button
            href={`${apiBase || ""}/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
          >
            openapi.json
          </Button>
        </Space>
        <Divider style={{ margin: "8px 0" }} />
        {/* Embedded Swagger so people don't need to leave the app. */}
        <iframe
          src={swaggerUrl}
          title="Swagger UI"
          style={{
            width: "100%",
            height: "70vh",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
          }}
        />
      </Space>
    </Card>
  );

  const tabs: {
    key: string;
    label: React.ReactNode;
    children: React.ReactNode;
  }[] = [
    {
      key: "general",
      label: (
        <span>
          <SettingOutlined /> Общие
        </span>
      ),
      children: generalTab,
    },
    {
      key: "api",
      label: (
        <span>
          <ApiOutlined /> API
        </span>
      ),
      children: apiTab,
    },
  ];
  if (isAdmin) {
    tabs.push({
      key: "brand",
      label: (
        <span>
          <TagOutlined /> Бренд
        </span>
      ),
      children: <BrandTab />,
    });
  }

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {t("settings.title")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t("settings.subtitle")}
      </Typography.Paragraph>

      <Tabs defaultActiveKey="general" items={tabs} />
    </>
  );
}


/**
 * "Бренд" tab — admin-only. Lets an operator customize the product
 * name and logo shown across the UI. Defaults (empty fields / no
 * files) revert to the built-in Markov branding.
 *
 * Kept in this file because it's only ~one screen and lives only
 * here — no reason to carve out a separate module for it yet.
 */
function BrandTab() {
  const qc = useQueryClient();
  const [nameForm] = Form.useForm<{ product_name: string; short_name: string }>();

  const brandingQ = useQuery({
    queryKey: ["system-branding"],
    queryFn: getBranding,
  });
  useEffect(() => {
    if (brandingQ.data) {
      nameForm.setFieldsValue({
        product_name: brandingQ.data.product_name ?? "",
        short_name: brandingQ.data.short_name ?? "",
      });
    }
  }, [brandingQ.data, nameForm]);

  const saveNames = useMutation({
    mutationFn: patchBrandingNames,
    onSuccess: () => {
      notify.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const uploadFront = useMutation({
    mutationFn: uploadBrandingLogo,
    onSuccess: () => {
      notify.success("Логотип загружен");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const uploadBack = useMutation({
    mutationFn: uploadBrandingLogoBack,
    onSuccess: () => {
      notify.success("Обратная сторона логотипа загружена");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const delFront = useMutation({
    mutationFn: deleteBrandingLogo,
    onSuccess: () => {
      notify.success("Логотип удалён");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
  });
  const delBack = useMutation({
    mutationFn: deleteBrandingLogoBack,
    onSuccess: () => {
      notify.success("Удалено");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
  });
  const saveTokens = useMutation({
    mutationFn: patchBrandingTokens,
    onSuccess: () => {
      notify.success("Палитра темы сохранена");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  const uploadFav = useMutation({
    mutationFn: uploadBrandingFavicon,
    onSuccess: () => {
      notify.success("Иконка вкладки загружена");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });
  const delFav = useMutation({
    mutationFn: deleteBrandingFavicon,
    onSuccess: () => {
      notify.success("Иконка вкладки удалена");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
  });
  const resetAll = useMutation({
    mutationFn: resetBranding,
    onSuccess: () => {
      notify.success("Бренд сброшен до значений по умолчанию");
      qc.invalidateQueries({ queryKey: ["system-branding"] });
    },
  });

  const data = brandingQ.data;
  const frontUrl = brandingAssetUrl(data?.logo_path ?? null);
  const backUrl = brandingAssetUrl(data?.logo_back_path ?? null);
  const faviconUrl = brandingAssetUrl(data?.favicon_path ?? null);

  return (
    <Card loading={brandingQ.isLoading}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Эти настройки применяются ко всей системе"
        description={
          <>
            Здесь можно заменить название и логотип Маркова на ваши. Пустые поля —
            значит использовать значения по&nbsp;умолчанию (анимированный флип и «Марков»).
            Видят изменения все пользователи, включая экран входа.
          </>
        }
      />

      {/* Preview — surface colors follow the active AntD theme so it
          works in both light and dark mode without hardcoded hex. */}
      <PreviewWell>
        <MarkovLogo size={48} logoUrl={frontUrl} logoBackUrl={backUrl} />
        <div>
          <Typography.Text strong style={{ fontSize: 18 }}>
            {data?.product_name?.trim() || "Марков"}
          </Typography.Text>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Так выглядит в боковой панели и на странице входа
          </div>
        </div>
      </PreviewWell>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Название
      </Typography.Title>
      <Form
        form={nameForm}
        layout="vertical"
        onFinish={(v) =>
          saveNames.mutate({
            product_name: v.product_name || null,
            short_name: v.short_name || null,
          })
        }
      >
        <Form.Item
          name="product_name"
          label="Название продукта"
          extra="Основное название. Пусто = «Марков»."
        >
          <Input placeholder="Например: QA Agent" allowClear />
        </Form.Item>
        <Form.Item
          name="short_name"
          label="Короткое название"
          extra="Для вкладки браузера и других узких мест. Пусто = совпадает с основным."
        >
          <Input placeholder="Например: QA" allowClear />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveNames.isPending}>
          Сохранить название
        </Button>
      </Form>

      <Divider />

      <Typography.Title level={5}>Логотипы и иконка</Typography.Title>
      <Typography.Paragraph style={{ marginBottom: 16, color: "inherit", opacity: 0.75 }}>
        PNG, JPG, WebP, SVG или GIF, до 2 МБ (для favicon: ICO/PNG/SVG/WebP, до 512 КБ).
        Рекомендуем квадратную картинку с прозрачным фоном. Для анимированного флипа
        (как сейчас у Маркова с «Альфой») загрузите основной логотип + обратную сторону.
      </Typography.Paragraph>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginBottom: 16,
        }}
      >
        <LogoSlot
          title="Основной логотип"
          description="Отображается всегда, если загружен."
          url={frontUrl}
          uploading={uploadFront.isPending}
          onUpload={(f) => uploadFront.mutate(f)}
          onDelete={() => delFront.mutate()}
          deleting={delFront.isPending}
        />
        <LogoSlot
          title="Обратная сторона (флип)"
          description="Если задана — логотип анимируется, переворачиваясь между двумя сторонами."
          url={backUrl}
          uploading={uploadBack.isPending}
          onUpload={(f) => uploadBack.mutate(f)}
          onDelete={() => delBack.mutate()}
          deleting={delBack.isPending}
          disabled={!frontUrl}
          disabledHint="Сначала загрузите основной логотип"
        />
        <LogoSlot
          title="Favicon (вкладка браузера)"
          description="Маленькая иконка в заголовке вкладки, закладках и истории."
          url={faviconUrl}
          uploading={uploadFav.isPending}
          onUpload={(f) => uploadFav.mutate(f)}
          onDelete={() => delFav.mutate()}
          deleting={delFav.isPending}
          accept=".ico,.png,.svg,.webp"
        />
      </div>

      <Divider />

      <ThemePaletteSection
        tokens={data?.theme_tokens ?? null}
        saving={saveTokens.isPending}
        onSave={(v) => saveTokens.mutate(v)}
      />

      <Divider />

      <Popconfirm
        title="Сбросить весь бренд?"
        description="Название и все логотипы будут удалены. Система вернётся к виду по умолчанию."
        onConfirm={() => resetAll.mutate()}
        okText="Сбросить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <Button danger icon={<ReloadOutlined />} loading={resetAll.isPending}>
          Сбросить бренд до значений по умолчанию
        </Button>
      </Popconfirm>
    </Card>
  );
}


function LogoSlot({
  title,
  description,
  url,
  uploading,
  onUpload,
  onDelete,
  deleting,
  disabled = false,
  disabledHint,
  accept = ".png,.jpg,.jpeg,.webp,.svg,.gif",
}: {
  title: string;
  description: string;
  url: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  deleting: boolean;
  disabled?: boolean;
  disabledHint?: string;
  /** Override allowed file extensions (defaults to the logo list). */
  accept?: string;
}) {
  const { token } = antdTheme.useToken();
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        padding: 16,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Typography.Text strong>{title}</Typography.Text>
      {/* colorTextTertiary reads in dark mode too; type="secondary"
          is too dim against the card bg. */}
      <div style={{ fontSize: 12, margin: "4px 0 12px", color: token.colorTextTertiary }}>
        {description}
      </div>
      <div
        style={{
          height: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: url ? token.colorBgContainer : token.colorFillQuaternary,
          border: `1px dashed ${token.colorBorder}`,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        {url ? (
          <img
            src={url}
            alt={title}
            style={{ maxHeight: 96, maxWidth: "80%", objectFit: "contain" }}
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {disabled ? disabledHint : "Файл не загружен"}
          </Typography.Text>
        )}
      </div>
      <Space>
        <Upload
          accept={accept}
          showUploadList={false}
          disabled={disabled}
          beforeUpload={(f) => {
            onUpload(f);
            return false;
          }}
        >
          <Button
            icon={<CloudUploadOutlined />}
            loading={uploading}
            disabled={disabled}
          >
            {url ? "Заменить" : "Загрузить"}
          </Button>
        </Upload>
        {url && (
          <Popconfirm
            title="Удалить файл?"
            onConfirm={onDelete}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button danger loading={deleting}>
              Удалить
            </Button>
          </Popconfirm>
        )}
      </Space>
    </div>
  );
}


/**
 * Color pickers for the active theme token (``colorPrimary``) in light
 * and dark mode. Ant Design derives the rest of the palette (hover,
 * focus, bg, border) from this one value, so in practice the user
 * only needs to pick one hue per theme.
 *
 * Local ``useState`` on the hex values so the picker is interactive
 * without beating up the network on every hue drag — "Сохранить"
 * commits.
 */
/** Theme-aware "card-on-card" container. Uses Ant Design's token
 *  system so the colors follow light/dark mode automatically. */
function PreviewWell({ children }: { children: React.ReactNode }) {
  const { token } = antdTheme.useToken();
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        padding: "16px 20px",
        background: token.colorFillTertiary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}


function ThemePaletteSection({
  tokens,
  saving,
  onSave,
}: {
  tokens: import("@/types").ThemeTokens | null;
  saving: boolean;
  onSave: (v: import("@/types").ThemeTokens | null) => void;
}) {
  return (
    <>
      <Typography.Title level={5}>Палитра темы</Typography.Title>
      <ThemeTokensEditor
        value={tokens}
        saving={saving}
        onSave={onSave}
        labels={{
          intro: (
            <>
              Применяется ко всей системе. Пустые/стандартные значения — значит
              использовать встроенную палитру Маркова. Каждый пользователь
              может переопределить эти значения только для себя в своём
              профиле.
            </>
          ),
          saveLabel: "Сохранить палитру",
          resetAllLabel: "Сбросить палитру к стандартной",
        }}
      />
    </>
  );
}
