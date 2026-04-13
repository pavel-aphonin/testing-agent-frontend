import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collapse, Form, InputNumber, Modal, Select, Tag, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { notify } from "@/utils/notify";

import { createRunV2, uploadApp } from "@/api/runs";
import { listActiveDevices } from "@/api/devices";
import { getMySettings } from "@/api/settings";
import type { AppUploadResponse, RunCreateV2, RunMode, DeviceConfigRead } from "@/types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewRunModal({ open, onClose }: NewRunModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RunCreateV2>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadResult, setUploadResult] = useState<AppUploadResponse | null>(null);

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
        onFinish={(values) => {
          if (!uploadResult) return;
          submitMutation.mutate({
            app_file_id: uploadResult.upload_id,
            device_config_id: values.device_config_id,
            mode: values.mode,
            max_steps: values.max_steps,
            c_puct: values.c_puct,
            rollout_depth: values.rollout_depth,
          });
        }}
        initialValues={{
          mode: "hybrid",
          max_steps: 200,
          c_puct: 2.0,
          rollout_depth: 5,
        }}
      >
        {/* ---------- File upload ---------- */}
        <Form.Item label={t("newRunModal.uploadApp")}>
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
          label={t("newRunModal.selectDevice")}
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
        <Form.Item name="mode" label={t("newRunModal.mode")}>
          <Select options={modeOptions} />
        </Form.Item>

        {/* ---------- Max steps ---------- */}
        <Form.Item name="max_steps" label={t("newRunModal.maxSteps")}>
          <InputNumber min={1} max={10000} style={{ width: "100%" }} />
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
      </Form>
    </Modal>
  );
}
