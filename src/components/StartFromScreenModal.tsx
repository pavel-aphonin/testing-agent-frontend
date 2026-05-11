import { useMutation } from "@tanstack/react-query";
import { Form, InputNumber, Modal, Select, Typography } from "antd";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { startFromScreen } from "@/api/runs";
import { notify } from "@/utils/notify";

/**
 * PER-41: confirmation modal for "start a new run from this screen".
 * Triggered from the graph node context menu (PER-42 hub).
 *
 * Mode + max_steps default to source-run values via the form's
 * initialValues prop; the user mostly just clicks "Запустить" and
 * gets redirected to the new run's progress page.
 */

interface Props {
  open: boolean;
  sourceRunId: string;
  screenHash: string | null;
  defaultMode?: string;
  onClose: () => void;
}

interface FormShape {
  mode: string;
  max_steps: number;
}

export function StartFromScreenModal({
  open, sourceRunId, screenHash, defaultMode, onClose,
}: Props) {
  const [form] = Form.useForm<FormShape>();
  const nav = useNavigate();

  // Reset to defaults each time the modal opens for a new screen
  // hash — keeps state from leaking between right-clicks.
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        // Default to AI for ad-hoc "start from this screen" runs —
        // most likely the user is debugging a specific flow and
        // wants the strongest exploration. Hybrid stays available
        // as an explicit choice.
        mode: defaultMode ?? "ai",
        max_steps: 30,
      });
    }
  }, [open, screenHash, defaultMode, form]);

  const m = useMutation({
    mutationFn: (v: FormShape) =>
      startFromScreen(sourceRunId, {
        target_screen_hash: screenHash!,
        mode: v.mode,
        max_steps: v.max_steps,
      }),
    onSuccess: (created) => {
      notify.success("Run создан");
      onClose();
      nav(`/runs/${created.id}/progress`);
    },
    onError: (e: any) => notify.error(e?.response?.data?.detail ?? "Ошибка"),
  });

  return (
    <Modal
      open={open}
      title="Стартовать новый run от этого экрана"
      onCancel={onClose}
      onOk={() => form.validateFields().then((v) => m.mutate(v))}
      okText="Запустить"
      cancelText="Отмена"
      confirmLoading={m.isPending}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Backend ищет кратчайший путь к выбранному экрану в графе
        исходного run-а, проигрывает его, затем переходит к свободному
        исследованию с указанным числом шагов. Если путь не найден —
        запуск откажется с ошибкой.
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="mode" label="Режим">
          <Select
            options={[
              { value: "ai", label: "AI (LLM на каждом шаге)" },
              { value: "hybrid", label: "Hybrid (PUCT + LLM-приоритеты)" },
              { value: "mc", label: "MC (Monte-Carlo, без LLM)" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="max_steps"
          label="Максимум шагов после navigation"
          rules={[{ required: true }]}
        >
          <InputNumber min={1} max={1000} step={10} style={{ width: 160 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
