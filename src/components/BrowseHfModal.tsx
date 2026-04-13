import { ArrowLeftOutlined, DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listHfRepoFiles, searchHfModels, startHfDownload } from "@/api/hf";
import { useAuthStore } from "@/store/auth";
import { notify } from "@/utils/notify";
import type {
  HfDownloadEvent,
  HfDownloadRequest,
  HfFile,
  HfRepoSummary,
} from "@/types";

// ---------------------------------------------------------------------------
//
// Three-step flow:
//   1. Search    → pick a repo
//   2. Files     → pick a .gguf file (plus optional mmproj for vision)
//   3. Download  → fill metadata form, fire POST, follow WS progress, done
//
// We stay inside a single <Modal> across all three steps and use the
// Steps component at the top to show which step we're on. The steps are
// driven by local state — no router involvement, so closing the modal
// resets everything the next time it's opened.
//
// ---------------------------------------------------------------------------

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function wsBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  return base.replace(/^http/, "ws");
}

/**
 * Guess sensible defaults for the download form from a filename.
 * For example, `gemma-4-E4B-it-Q4_K_M.gguf` → name "gemma-4-e4b-it",
 * family "gemma-4", quantization "Q4_K_M". These are only starting
 * points — the admin sees the form and can override.
 */
function guessDefaults(
  filename: string,
): Pick<HfDownloadRequest, "name" | "family" | "quantization"> {
  const base = filename.replace(/\.gguf$/i, "");

  // Pull the quant out — matches things like Q4_K_M, IQ4_NL, UD-Q4_K_XL.
  const quantMatch = base.match(
    /(UD-)?(IQ?\d_[KS]?_?[A-Z0-9]*|Q\d_[KS]?_?[A-Z0-9]*|F16|BF16|F32)/i,
  );
  const quantization = quantMatch ? quantMatch[0] : "";

  // Family hint: look at the start of the filename.
  const lower = base.toLowerCase();
  let family = "";
  if (lower.startsWith("gemma")) family = lower.match(/gemma-?\d+/)?.[0] ?? "gemma";
  else if (lower.startsWith("qwen")) family = lower.match(/qwen-?\d(\.\d)?/)?.[0] ?? "qwen";
  else if (lower.startsWith("llama")) family = lower.match(/llama-?\d/)?.[0] ?? "llama";
  else if (lower.startsWith("phi")) family = "phi";
  else if (lower.startsWith("mistral")) family = "mistral";

  // Name: drop the quant suffix so it stays stable across requantizations.
  let name = base;
  if (quantization) {
    name = base.replace(new RegExp(`[-_]?${quantization}.*$`, "i"), "");
  }
  name = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  return { name, family, quantization };
}

export function BrowseHfModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [query, setQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<HfRepoSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<HfFile | null>(null);

  // Reset everything whenever the modal opens.
  useEffect(() => {
    if (open) {
      setStep(0);
      setQuery("");
      setSelectedRepo(null);
      setSelectedFile(null);
    }
  }, [open]);

  const title = useMemo(() => {
    if (step === 0) return t("browseHf.title");
    if (step === 1) return t("browseHf.filesIn", { repo: selectedRepo?.repo_id ?? "" });
    return t("browseHf.downloadTitle", { filename: selectedFile?.filename ?? "" });
  }, [step, selectedRepo, selectedFile, t]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 16 }}
        items={[
          { title: t("browseHf.step1Search") },
          { title: t("browseHf.step2Files") },
          { title: t("browseHf.step3Download") },
        ]}
      />

      {step === 0 && (
        <SearchStep
          query={query}
          onQueryChange={setQuery}
          onPick={(repo) => {
            setSelectedRepo(repo);
            setStep(1);
          }}
        />
      )}

      {step === 1 && selectedRepo && (
        <FilesStep
          repo={selectedRepo}
          onBack={() => setStep(0)}
          onPick={(file) => {
            setSelectedFile(file);
            setStep(2);
          }}
        />
      )}

      {step === 2 && selectedRepo && selectedFile && (
        <DownloadStep
          repo={selectedRepo}
          file={selectedFile}
          onBack={() => setStep(1)}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Step 1: search

function SearchStep({
  query,
  onQueryChange,
  onPick,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (repo: HfRepoSummary) => void;
}) {
  const { t } = useTranslation();

  // We debounce by only enabling the query when `query.length >= 3`.
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["hf-search", query],
    queryFn: () => searchHfModels(query, 20),
    enabled: query.trim().length >= 3,
    staleTime: 60_000,
  });

  const columns: ColumnsType<HfRepoSummary> = [
    {
      title: t("browseHf.columns.repository"),
      dataIndex: "repo_id",
      key: "repo_id",
      render: (id: string, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{id}</Typography.Text>
          <Space size={4} wrap>
            {record.tags
              .filter(
                (tg) =>
                  tg === "gguf" ||
                  tg.startsWith("base_model:") === false &&
                    tg.length < 20 &&
                    !tg.startsWith("region:") &&
                    !tg.startsWith("license:"),
              )
              .slice(0, 6)
              .map((tg) => (
                <Tag key={tg} style={{ fontSize: 10 }}>
                  {tg}
                </Tag>
              ))}
          </Space>
        </Space>
      ),
    },
    {
      title: t("browseHf.columns.downloads"),
      dataIndex: "downloads",
      key: "downloads",
      width: 130,
      align: "right",
      render: (n: number | null) => (n != null ? n.toLocaleString() : "—"),
    },
    {
      title: t("browseHf.columns.likes"),
      dataIndex: "likes",
      key: "likes",
      width: 80,
      align: "right",
      render: (n: number | null) => n ?? "—",
    },
    {
      title: "",
      key: "pick",
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => onPick(record)}>
          {t("browseHf.browseFiles")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
        <Input
          placeholder={t("browseHf.searchPlaceholder")}
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onPressEnter={() => refetch()}
          allowClear
        />
        <Button type="primary" onClick={() => refetch()} loading={isFetching}>
          {t("common.search")}
        </Button>
      </Space.Compact>

      {query.length > 0 && query.length < 3 && (
        <Alert
          type="info"
          showIcon
          message={t("browseHf.searchMinChars")}
          style={{ marginBottom: 12 }}
        />
      )}
      {isError && (
        <Alert
          type="error"
          showIcon
          message={t("browseHf.searchFailed")}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table<HfRepoSummary>
        rowKey="repo_id"
        columns={columns}
        dataSource={data ?? []}
        loading={isFetching && query.length >= 3}
        pagination={{ pageSize: 10, size: "small" }}
        size="small"
        locale={{
          emptyText:
            query.trim().length >= 3 ? t("browseHf.noResults") : t("browseHf.enterQuery"),
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Step 2: files

function FilesStep({
  repo,
  onBack,
  onPick,
}: {
  repo: HfRepoSummary;
  onBack: () => void;
  onPick: (file: HfFile) => void;
}) {
  const { t } = useTranslation();

  const { data, isFetching, isError } = useQuery({
    queryKey: ["hf-files", repo.repo_id],
    queryFn: () => listHfRepoFiles(repo.repo_id),
    staleTime: 5 * 60_000,
  });

  const columns: ColumnsType<HfFile> = [
    {
      title: t("browseHf.columns.file"),
      dataIndex: "filename",
      key: "filename",
      render: (name: string) => <Typography.Text code>{name}</Typography.Text>,
    },
    {
      title: t("browseHf.columns.size"),
      dataIndex: "size_bytes",
      key: "size",
      width: 140,
      align: "right",
      render: formatBytes,
    },
    {
      title: "",
      key: "pick",
      width: 110,
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => onPick(record)}>
          {t("browseHf.useThis")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          {t("common.back")}
        </Button>
        <Typography.Text type="secondary">
          {t("browseHf.showingGguf")} <Typography.Text code>{repo.repo_id}</Typography.Text>
        </Typography.Text>
      </Space>

      {isError && (
        <Alert type="error" showIcon message={t("browseHf.loadFilesFailed")} />
      )}

      <Table<HfFile>
        rowKey="filename"
        columns={columns}
        dataSource={data ?? []}
        loading={isFetching}
        pagination={{ pageSize: 20, size: "small" }}
        size="small"
      />
    </>
  );
}

// ---------------------------------------------------------- Step 3: download + WS

function DownloadStep({
  repo,
  file,
  onBack,
  onDone,
}: {
  repo: HfRepoSummary;
  file: HfFile;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [form] = Form.useForm<HfDownloadRequest>();

  // null means: we haven't started yet, still on the form
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    downloaded: number;
    total: number | null;
    file: string;
  } | null>(null);
  const [terminal, setTerminal] = useState<
    | { kind: "done"; model_name: string }
    | { kind: "error"; error: string }
    | null
  >(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Also list mmproj candidates for this repo so the user can opt in
  // to vision support with one click — defaults to the F16 mmproj when
  // present, which is what unsloth and lmstudio publish.
  const { data: allFiles } = useQuery({
    queryKey: ["hf-files", repo.repo_id],
    queryFn: () => listHfRepoFiles(repo.repo_id),
    staleTime: 5 * 60_000,
  });
  const mmprojCandidates = (allFiles ?? [])
    .filter((f) => f.filename.toLowerCase().includes("mmproj"))
    .map((f) => f.filename);
  const defaultMmproj =
    mmprojCandidates.find((f) => /f16/i.test(f)) ?? mmprojCandidates[0] ?? null;

  const defaults = useMemo(
    () => guessDefaults(file.filename),
    [file],
  );

  const startMutation = useMutation({
    mutationFn: startHfDownload,
    onSuccess: (resp) => {
      setDownloadId(resp.download_id);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("browseHf.downloadFailed");
      notify.error(detail);
    },
  });

  // Open the WS as soon as we have a download_id.
  useEffect(() => {
    if (!downloadId || !token) return;
    const url = `${wsBase()}/ws/admin/downloads/${downloadId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as HfDownloadEvent;
        if (ev.type === "progress") {
          setProgress({
            downloaded: ev.downloaded,
            total: ev.total,
            file: ev.file,
          });
        } else if (ev.type === "download_complete") {
          setTerminal({ kind: "done", model_name: ev.model_name });
          queryClient.invalidateQueries({ queryKey: ["admin-models"] });
          queryClient.invalidateQueries({ queryKey: ["public-models"] });
        } else if (ev.type === "download_failed") {
          setTerminal({ kind: "error", error: ev.error });
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => {
      // If the WS fails we don't want to leave the user stuck on a
      // spinner — surface it as a terminal error.
      setTerminal({
        kind: "error",
        error: "WebSocket connection lost",
      });
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [downloadId, token, queryClient]);

  const pct = useMemo(() => {
    if (!progress || !progress.total) return 0;
    return Math.floor((progress.downloaded / progress.total) * 100);
  }, [progress]);

  // --- The form (before starting the download) ---
  if (!downloadId) {
    return (
      <>
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            {t("common.back")}
          </Button>
          <Typography.Text type="secondary">
            {repo.repo_id} / <Typography.Text code>{file.filename}</Typography.Text>
            {file.size_bytes ? ` · ${formatBytes(file.size_bytes)}` : ""}
          </Typography.Text>
        </Space>

        <Form<HfDownloadRequest>
          form={form}
          layout="vertical"
          onFinish={(values) =>
            startMutation.mutate({
              ...values,
              repo_id: repo.repo_id,
              filename: file.filename,
            })
          }
          initialValues={{
            name: defaults.name,
            family: defaults.family,
            quantization: defaults.quantization,
            context_length: 32768,
            supports_vision: !!defaultMmproj,
            supports_tool_use: true,
            default_temperature: 0.7,
            default_top_p: 0.9,
            mmproj_filename: defaultMmproj,
          }}
        >
          <Form.Item
            name="name"
            label={t("browseHf.form.nameLabel")}
            rules={[{ required: true, message: t("browseHf.form.nameRequired") }]}
            extra={t("browseHf.form.namePlaceholder")}
          >
            <Input placeholder="e.g. gemma-4-e4b" />
          </Form.Item>

          <Space style={{ width: "100%" }}>
            <Form.Item
              name="family"
              label={t("browseHf.form.familyLabel")}
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 180 }}
            >
              <Input placeholder={t("browseHf.form.familyPlaceholder")} />
            </Form.Item>
            <Form.Item
              name="quantization"
              label={t("browseHf.form.quantLabel")}
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 140 }}
            >
              <Input placeholder={t("browseHf.form.quantPlaceholder")} />
            </Form.Item>
            <Form.Item
              name="context_length"
              label={t("browseHf.form.contextLabel")}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={128} max={1_000_000} style={{ width: 140 }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="mmproj_filename"
            label={t("browseHf.form.mmprojLabel")}
            extra={
              mmprojCandidates.length === 0
                ? t("browseHf.form.mmprojNone")
                : t("browseHf.form.mmprojHelp")
            }
          >
            <Input
              placeholder={
                mmprojCandidates.length === 0
                  ? t("browseHf.form.mmprojPlaceholder")
                  : mmprojCandidates.join(" · ")
              }
              disabled={mmprojCandidates.length === 0}
            />
          </Form.Item>

          <Space>
            <Form.Item
              name="supports_tool_use"
              label={t("browseHf.form.toolUse")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="supports_vision"
              label={t("browseHf.form.vision")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="description" label={t("browseHf.form.descriptionLabel")}>
            <Input.TextArea rows={2} placeholder={t("browseHf.form.descriptionPlaceholder")} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              htmlType="submit"
              loading={startMutation.isPending}
              block
            >
              {t("browseHf.startDownload")}
            </Button>
          </Form.Item>
        </Form>
      </>
    );
  }

  // --- Progress / terminal state ---
  return (
    <div style={{ padding: "16px 8px" }}>
      <Typography.Title level={5}>
        {t("browseHf.downloading", { filename: file.filename })}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t("browseHf.from")} <Typography.Text code>{repo.repo_id}</Typography.Text>
      </Typography.Text>

      <Progress
        percent={terminal?.kind === "done" ? 100 : pct}
        status={
          terminal?.kind === "error"
            ? "exception"
            : terminal?.kind === "done"
              ? "success"
              : "active"
        }
        style={{ marginTop: 16 }}
      />
      {progress && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {progress.file}: {formatBytes(progress.downloaded)} /{" "}
          {formatBytes(progress.total)}
        </Typography.Text>
      )}

      {terminal?.kind === "done" && (
        <Alert
          type="success"
          showIcon
          message={t("browseHf.downloadComplete", { name: terminal.model_name })}
          style={{ marginTop: 16 }}
          action={
            <Button type="primary" onClick={onDone}>
              {t("common.close")}
            </Button>
          }
        />
      )}
      {terminal?.kind === "error" && (
        <Alert
          type="error"
          showIcon
          message={t("browseHf.downloadFailed")}
          description={terminal.error}
          style={{ marginTop: 16 }}
          action={<Button onClick={onDone}>{t("common.close")}</Button>}
        />
      )}
    </div>
  );
}
