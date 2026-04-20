import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collapse, Form, Input, InputNumber, Modal, Select, Switch, Tag, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { notify } from "@/utils/notify";
import { LabelWithHint } from "@/components/LabelWithHint";

import { createRunV2, uploadApp } from "@/api/runs";
import { listAttributes } from "@/api/attributes";
import { useWorkspaceStore } from "@/store/workspace";
import { listActiveDevices } from "@/api/devices";
import { listScenarios } from "@/api/scenarios";
import { getMySettings } from "@/api/settings";
import { DatePicker, Divider } from "antd";
import dayjs from "dayjs";
import type { AppUploadResponse, AttributeRead, RunCreateV2, RunMode, DeviceConfigRead } from "@/types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewRunModal({ open, onClose }: NewRunModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RunCreateV2>();
  const queryClient = useQueryClient();
  const workspace = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadResult, setUploadResult] = useState<AppUploadResponse | null>(null);
  const [useScenarios, setUseScenarios] = useState(false);
  const [pbtEnabled, setPbtEnabled] = useState(false);

  const modeOptions: { value: RunMode; label: string }[] = [
    { value: "hybrid", label: t("newRunModal.modes.hybrid") },
    { value: "mc", label: t("newRunModal.modes.mc") },
    { value: "ai", label: t("newRunModal.modes.ai") },
  ];

  // Pre-load the user's saved defaults so the modal opens with them.
  const settingsQuery = useQuery({
    queryKey: ["my-settings"],
    queryFn: getMySettings,
    enabled: open,
  });

  const devicesQuery = useQuery({
    queryKey: ["active-devices"],
    queryFn: listActiveDevices,
    enabled: open,
  });

  // Run-scoped attributes — rendered as extra form fields so users can
  // set custom metadata (ticket number, tester name, etc.) at create time.
  const runAttrsQ = useQuery({
    queryKey: ["run-attributes"],
    queryFn: () => listAttributes("run"),
    enabled: open,
  });

  const scenariosQuery = useQuery({
    queryKey: ["scenarios", workspace?.id ?? "none"],
    queryFn: () => listScenarios(workspace?.id),
    enabled: open && useScenarios,
  });

  // Filter devices by the platform of the uploaded app.
  const filteredDevices = (devicesQuery.data ?? []).filter(
    (d: DeviceConfigRead) =>
      !uploadResult || d.platform === uploadResult.platform,
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setUploadStatus("idle");
    setUploadResult(null);
    setUseScenarios(false);
    setPbtEnabled(false);
    if (settingsQuery.data) {
      form.setFieldsValue({
        mode: settingsQuery.data.default_mode,
        max_steps: settingsQuery.data.default_max_steps,
        c_puct: settingsQuery.data.c_puct,
        rollout_depth: settingsQuery.data.rollout_depth,
      });
    }
  }, [open, form, settingsQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: uploadApp,
    onSuccess: (data: AppUploadResponse) => {
      setUploadStatus("success");
      setUploadResult(data);
      // Clear device selection when a new file is uploaded — the previous
      // selection may belong to a different platform.
      form.setFieldValue("device_config_id", undefined);
    },
    onError: () => {
      setUploadStatus("error");
      notify.error(t("newRunModal.uploadFailed"));
    },
  });

  const submitMutation = useMutation({
    mutationFn: createRunV2,
    onSuccess: (run) => {
      notify.success(t("newRunModal.started"));
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      onClose();
      navigate(`/runs/${run.id}/progress`);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("newRunModal.startFailed");
      notify.error(detail);
    },
  });

  return (
    <Modal
      title={t("newRunModal.title")}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t("newRunModal.start")}
      cancelText={t("common.cancel")}
      confirmLoading={submitMutation.isPending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values: any) => {
          if (!uploadResult) return;
          // Extract run-attribute values from the form (prefixed with "attr_")
          const attrValues: Record<string, unknown> = {};
          for (const attr of runAttrsQ.data ?? []) {
            if (attr.is_group) continue;
            const raw = values[`attr_${attr.id}`];
            // Normalize dayjs → ISO for date attributes
            attrValues[attr.id] =
              attr.data_type === "date" && raw && typeof raw === "object" && "toISOString" in raw
                ? (raw as dayjs.Dayjs).toISOString()
                : raw ?? null;
          }
          submitMutation.mutate({
            title: values.title || undefined,
            app_file_id: uploadResult.upload_id,
            device_config_id: values.device_config_id,
            mode: values.mode,
            max_steps: values.max_steps,
            c_puct: values.c_puct,
            rollout_depth: values.rollout_depth,
            scenario_ids: useScenarios ? (values.scenario_ids ?? []) : [],
            pbt_enabled: pbtEnabled,
            workspace_id: workspace?.id,
            attribute_values: Object.keys(attrValues).length > 0 ? attrValues : undefined,
          });
        }}
        initialValues={{
          mode: "hybrid",
          max_steps: 200,
          c_puct: 2.0,
          rollout_depth: 5,
        }}
      >
        {/* ---------- Title (optional) ---------- */}
        <Form.Item
          name="title"
          label={
            <LabelWithHint
              label="Название запуска"
              hint="Произвольное название, чтобы быстро находить запуск в списке. Например, «Smoke 15.04» или «Регресс после правки логина». Если оставить пустым, будет использовано «Запуск от {дата}»."
            />
          }
        >
          <Input
            placeholder="Например, «Smoke после релиза 1.2.0» (необязательно)"
            maxLength={200}
            allowClear
          />
        </Form.Item>

        {/* ---------- File upload ---------- */}
        <Form.Item label={<LabelWithHint label={t("newRunModal.uploadApp")} hint="Загрузите файл сборки приложения. Поддерживаются .app.zip и .ipa для iOS, .apk для Android." />}>
          {uploadStatus === "success" && uploadResult ? (
            <Tag color="green">
              {"\u2713"} {uploadResult.bundle_id} (
              {uploadResult.platform === "ios" ? "iOS" : "Android"})
            </Tag>
          ) : (
            <Upload.Dragger
              accept=""
              showUploadList={false}
              beforeUpload={(file) => {
                setUploadStatus("uploading");
                setUploadResult(null);
                uploadMutation.mutate(file);
                return false; // prevent AntD's default upload behaviour
              }}
              disabled={uploadStatus === "uploading"}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {uploadStatus === "uploading"
                  ? t("newRunModal.uploadingApp")
                  : t("newRunModal.uploadAppHelp")}
              </p>
            </Upload.Dragger>
          )}
        </Form.Item>

        {/* ---------- Device config dropdown ---------- */}
        <Form.Item
          name="device_config_id"
          label={<LabelWithHint label={t("newRunModal.selectDevice")} hint="Устройство + версия ОС, на котором будет запущено исследование. Список управляется администратором в разделе «Устройства»." />}
          rules={[{ required: true, message: t("newRunModal.selectDevicePlaceholder") }]}
        >
          <Select
            placeholder={t("newRunModal.selectDevicePlaceholder")}
            disabled={uploadStatus !== "success"}
            notFoundContent={t("newRunModal.noDevices")}
            options={filteredDevices.map((d: DeviceConfigRead) => ({
              value: d.id,
              label: `${d.device_type} \u00B7 ${d.os_version}`,
            }))}
          />
        </Form.Item>

        {/* ---------- Mode ---------- */}
        <Form.Item name="mode" label={<LabelWithHint label={t("newRunModal.mode")} hint="AI — LLM решает каждое действие. MC — случайный перебор. Hybrid — LLM подсказывает, Monte-Carlo проверяет. Для демо выбирайте Hybrid." />}>
          <Select options={modeOptions} />
        </Form.Item>

        {/* ---------- Max steps ---------- */}
        <Form.Item name="max_steps" label={<LabelWithHint label={t("newRunModal.maxSteps")} hint="Максимальное количество действий агента. Агент остановится раньше, если обнаружит, что все экраны исследованы." />}>
          <InputNumber min={1} max={10000} style={{ width: "100%" }} />
        </Form.Item>

        {/* ---------- Scenarios toggle ---------- */}
        <Form.Item
          label={
            <span>
              Использовать сценарии{" "}
              <Switch
                size="small"
                checked={useScenarios}
                onChange={setUseScenarios}
                style={{ marginLeft: 8 }}
              />
            </span>
          }
          style={{ marginBottom: useScenarios ? 8 : 16 }}
        >
          <span style={{ color: "#999", fontSize: 12 }}>
            Агент выполнит выбранные сценарии, затем продолжит свободное исследование
          </span>
        </Form.Item>

        {useScenarios && (
          <Form.Item
            name="scenario_ids"
            rules={[
              { required: true, message: "Выберите хотя бы один сценарий" },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Выберите сценарии для выполнения"
              loading={scenariosQuery.isLoading}
              options={(scenariosQuery.data ?? [])
                .filter((s) => s.is_active)
                .map((s) => ({ value: s.id, label: s.title }))}
              notFoundContent="Активных сценариев нет"
            />
          </Form.Item>
        )}

        {/* ---------- PBT toggle ---------- */}
        <Form.Item
          label={
            <span>
              <LabelWithHint
                label="Property-based testing"
                hint="Агент систематически проверяет валидацию форм: пустые значения, переполнение, спецсимволы (XSS, SQL-инъекции), unicode. Замедляет исследование в 5-8 раз, но находит больше дефектов валидации."
              />
              {"\u00A0"}
              <Switch
                size="small"
                checked={pbtEnabled}
                onChange={setPbtEnabled}
                style={{ marginLeft: 8 }}
              />
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <span style={{ color: "#999", fontSize: 12 }}>
            {pbtEnabled
              ? "Каждое поле формы будет протестировано на 4-8 вариантах данных"
              : "Агент использует только один валидный набор данных"}
          </span>
        </Form.Item>

        {/* ---------- Advanced settings ---------- */}
        <Collapse
          ghost
          items={[
            {
              key: "advanced",
              label: t("newRunModal.advancedSettings"),
              children: (
                <>
                  <Form.Item name="c_puct" label={t("newRunModal.cPuct")}>
                    <InputNumber
                      min={0}
                      max={10}
                      step={0.1}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="rollout_depth"
                    label={t("newRunModal.rolloutDepth")}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />

        {/* Run-scoped attributes (if any configured) */}
        {(runAttrsQ.data ?? []).filter((a) => !a.is_group).length > 0 && (
          <>
            <Divider orientation="left">Атрибуты запуска</Divider>
            {(runAttrsQ.data ?? [])
              .filter((a) => !a.is_group)
              .map((attr) => (
                <RunAttrField key={attr.id} attr={attr} />
              ))}
          </>
        )}
      </Form>
    </Modal>
  );
}

function RunAttrField({ attr }: { attr: AttributeRead }) {
  const label = (
    <span>
      {attr.name}
      {attr.is_required && <span style={{ color: "#cf1322" }}> *</span>}
    </span>
  );
  const rules = attr.is_required ? [{ required: true, message: "Обязательно" }] : [];
  const name = `attr_${attr.id}`;

  if (attr.data_type === "boolean") {
    return (
      <Form.Item name={name} label={label} valuePropName="checked" rules={rules}>
        <Switch />
      </Form.Item>
    );
  }
  if (attr.data_type === "number") {
    return (
      <Form.Item name={name} label={label} rules={rules}>
        <Input type="number" />
      </Form.Item>
    );
  }
  if (attr.data_type === "date") {
    return (
      <Form.Item name={name} label={label} rules={rules}>
        <DatePicker style={{ width: "100%" }} showTime />
      </Form.Item>
    );
  }
  if (attr.data_type === "enum") {
    const opts = (attr.enum_values ?? []).map((v) => ({ value: v, label: v }));
    return (
      <Form.Item name={name} label={label} rules={rules}>
        <Select options={opts} allowClear />
      </Form.Item>
    );
  }
  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Input placeholder={attr.description ?? ""} />
    </Form.Item>
  );
}
