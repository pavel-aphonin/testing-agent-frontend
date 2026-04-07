import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, InputNumber, Modal, Select, message } from "antd";
import { useEffect } from "react";

import { createRun } from "@/api/runs";
import type { RunCreate, RunMode } from "@/types";

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
}

const MODE_OPTIONS: { value: RunMode; label: string }[] = [
  { value: "hybrid", label: "Hybrid (PUCT + LLM priors)" },
  { value: "mc", label: "Monte Carlo (no LLM)" },
  { value: "ai", label: "AI-only (LLM every step)" },
];

export function NewRunModal({ open, onClose }: NewRunModalProps) {
  const [form] = Form.useForm<RunCreate>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: () => {
      message.success("Run created");
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create run";
      message.error(detail);
    },
  });

  return (
    <Modal
      title="New exploration run"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Start"
      confirmLoading={mutation.isPending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{
          platform: "ios",
          mode: "hybrid",
          max_steps: 200,
          c_puct: 2.0,
          rollout_depth: 5,
        }}
      >
        <Form.Item
          name="bundle_id"
          label="Bundle ID"
          rules={[{ required: true, message: "Bundle ID is required" }]}
        >
          <Input placeholder="org.reactjs.native.example.TestApp" />
        </Form.Item>

        <Form.Item
          name="device_id"
          label="Device ID"
          rules={[{ required: true, message: "Device ID is required" }]}
          extra="UDID of the booted simulator, or BOOTED for the active one"
        >
          <Input placeholder="BOOTED" />
        </Form.Item>

        <Form.Item name="mode" label="Mode">
          <Select options={MODE_OPTIONS} />
        </Form.Item>

        <Form.Item name="max_steps" label="Max steps">
          <InputNumber min={1} max={10000} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="c_puct" label="c_puct (PUCT exploration constant)">
          <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="rollout_depth" label="Rollout depth">
          <InputNumber min={0} max={100} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
