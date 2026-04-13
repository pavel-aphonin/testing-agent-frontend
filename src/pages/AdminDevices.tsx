import {
  DeleteOutlined,
  MobileOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/utils/notify";

import {
  createDeviceConfig,
  deleteDeviceConfig,
  getAvailableConfigs,
  listAllDevices,
  toggleDeviceConfig,
} from "@/api/devices";
import type { DeviceConfigRead } from "@/types";

interface AddDeviceForm {
  platform: "ios" | "android";
  device: string;
  runtime: string;
}

export function AdminDevices() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AddDeviceForm>();

  const devicesQuery = useQuery({
    queryKey: ["admin-devices"],
    queryFn: listAllDevices,
  });

  const availableQuery = useQuery({
    queryKey: ["available-configs"],
    queryFn: getAvailableConfigs,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createDeviceConfig,
    onSuccess: () => {
      notify.success(t("adminDevices.added"));
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      queryClient.invalidateQueries({ queryKey: ["active-devices"] });
      form.resetFields();
    },
    onError: () => notify.error(t("common.error")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleDeviceConfig(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      queryClient.invalidateQueries({ queryKey: ["active-devices"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeviceConfig,
    onSuccess: () => {
      notify.success(t("adminDevices.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      queryClient.invalidateQueries({ queryKey: ["active-devices"] });
    },
  });

  // Build dropdown options from worker-reported available configs
  const selectedPlatform = Form.useWatch("platform", form);

  const deviceTypeOptions = useMemo(() => {
    if (!availableQuery.data) return [];
    return availableQuery.data.device_types
      .filter((d) => !selectedPlatform || d.platform === selectedPlatform)
      .map((d) => ({
        value: JSON.stringify({ name: d.name, identifier: d.identifier }),
        label: d.name,
      }));
  }, [availableQuery.data, selectedPlatform]);

  const runtimeOptions = useMemo(() => {
    if (!availableQuery.data) return [];
    return availableQuery.data.runtimes
      .filter((r) => !selectedPlatform || r.platform === selectedPlatform)
      .map((r) => ({
        value: JSON.stringify({ name: r.name, identifier: r.identifier }),
        label: r.name,
      }));
  }, [availableQuery.data, selectedPlatform]);

  const onFinish = (values: AddDeviceForm) => {
    const device = JSON.parse(values.device);
    const runtime = JSON.parse(values.runtime);
    createMutation.mutate({
      platform: values.platform,
      device_type: device.name,
      device_identifier: device.identifier,
      os_version: runtime.name,
      os_identifier: runtime.identifier,
    });
  };

  const columns: ColumnsType<DeviceConfigRead> = [
    {
      title: t("adminDevices.columns.platform"),
      dataIndex: "platform",
      key: "platform",
      width: 100,
      render: (p: string) => (
        <Tag color={p === "ios" ? "blue" : "green"}>
          {p === "ios" ? "iOS" : "Android"}
        </Tag>
      ),
    },
    {
      title: t("adminDevices.columns.device"),
      dataIndex: "device_type",
      key: "device",
    },
    {
      title: t("adminDevices.columns.osVersion"),
      dataIndex: "os_version",
      key: "os",
      width: 150,
    },
    {
      title: t("adminDevices.columns.active"),
      dataIndex: "is_active",
      key: "active",
      width: 100,
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          onChange={(v) =>
            toggleMutation.mutate({ id: record.id, active: v })
          }
          size="small"
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_, record) => (
        <Popconfirm
          title={t("adminDevices.deleteConfirm")}
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText={t("common.delete")}
          cancelText={t("common.cancel")}
          okButtonProps={{ danger: true }}
        >
          <Button danger type="text" icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} size="middle">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("adminDevices.title")}
        </Typography.Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
            queryClient.invalidateQueries({ queryKey: ["available-configs"] });
          }}
          loading={devicesQuery.isFetching}
        >
          {t("common.refresh")}
        </Button>
      </Space>

      <Typography.Paragraph type="secondary">
        {t("adminDevices.subtitle")}
      </Typography.Paragraph>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card
            title={t("adminDevices.addTitle")}
            size="small"
            style={{ marginBottom: 16 }}
          >
            {availableQuery.isError && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={t("adminDevices.noWorker")}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              disabled={!availableQuery.data}
            >
              <Form.Item
                name="platform"
                label={t("adminDevices.platform")}
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: "ios", label: "iOS (iPhone / iPad)" },
                    { value: "android", label: "Android" },
                  ]}
                  onChange={() => {
                    form.setFieldsValue({ device: undefined, runtime: undefined });
                  }}
                />
              </Form.Item>

              <Form.Item
                name="device"
                label={t("adminDevices.deviceType")}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={deviceTypeOptions}
                  placeholder={t("adminDevices.selectDevice")}
                />
              </Form.Item>

              <Form.Item
                name="runtime"
                label={t("adminDevices.osVersion")}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={runtimeOptions}
                  placeholder={t("adminDevices.selectOs")}
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                icon={<PlusOutlined />}
                loading={createMutation.isPending}
                block
              >
                {t("adminDevices.addButton")}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={`${t("adminDevices.activeTitle")} (${devicesQuery.data?.length ?? 0})`}
            size="small"
          >
            <Table<DeviceConfigRead>
              rowKey="id"
              columns={columns}
              dataSource={devicesQuery.data ?? []}
              loading={devicesQuery.isLoading}
              pagination={false}
              size="small"
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: (
                  <Space direction="vertical" align="center" style={{ padding: 24 }}>
                    <MobileOutlined style={{ fontSize: 32, color: "#ccc" }} />
                    <Typography.Text type="secondary">
                      {t("adminDevices.noDevices")}
                    </Typography.Text>
                  </Space>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
