import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

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

  const settingsQuery = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
  });

  const modelsQuery = useQuery({
    queryKey: ["public-models"],
    queryFn: listActiveModels,
  });

  const modeOptions: { value: RunMode; label: string }[] = [
    { value: "hybrid", label: t("newRunModal.modes.hybrid") },
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

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {t("settings.title")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t("settings.subtitle")}
      </Typography.Paragraph>

      {modelsQuery.data && modelsQuery.data.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("settings.noModelsWarning")}
          description={t("settings.noModelsDescription")}
        />
      )}

      <Card loading={settingsQuery.isLoading} style={{ maxWidth: 640 }}>
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
              onClick={() => settingsQuery.data && form.setFieldsValue(settingsQuery.data)}
            >
              {t("common.reset")}
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  );
}
