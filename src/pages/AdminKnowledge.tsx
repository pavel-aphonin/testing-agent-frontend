import {
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  queryKnowledgeBase,
  reembedKnowledgeDocument,
} from "@/api/knowledge";
import { notify } from "@/utils/notify";
import type {
  KnowledgeDocumentCreate,
  KnowledgeDocumentSummary,
  KnowledgeMatch,
} from "@/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("ru-RU", { hour12: false });
  return `${day}.${month}.${year} ${time}`;
}

function isFakeEmbedding(name: string): boolean {
  return name.startsWith("fake-hash-");
}

/** Escape HTML and highlight query terms with yellow marker */
/** Escape HTML and highlight LLM-provided citations with yellow marker.
 *
 * `citations` are exact phrases from the source text that the LLM used to
 * generate the answer. Semantic (not keyword) highlighting: we mark the
 * actual grounding of the answer, not just query terms.
 */
function highlightCitations(text: string, citations: string[]): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escaped = escape(text);

  const clean = citations.map((c) => c.trim()).filter((c) => c.length >= 4);
  if (clean.length === 0) return escaped;

  // Escape regex metachars in citations; sort by length desc so longer
  // citations match before their sub-fragments.
  const patterns = clean
    .sort((a, b) => b.length - a.length)
    .map((c) => escape(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const regex = new RegExp(`(${patterns.join("|")})`, "gi");
  return escaped.replace(
    regex,
    '<mark style="background:#fff3b0;padding:0 2px;border-radius:2px">$1</mark>',
  );
}

export function AdminKnowledge() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<{
    embedding_model: string;
    answer?: string | null;
    citations?: string[];
    matches: KnowledgeMatch[];
  } | null>(null);

  const [uploadForm] = Form.useForm<KnowledgeDocumentCreate>();
  const [searchForm] = Form.useForm<{ query: string; top_k: number }>();

  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: listKnowledgeDocuments,
  });

  const createMutation = useMutation({
    mutationFn: createKnowledgeDocument,
    onSuccess: (doc) => {
      notify.success(
        t("knowledge.uploaded", { title: doc.title, count: doc.chunk_count }),
      );
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      setUploadOpen(false);
      setUploadedFileName(null);
      uploadForm.resetFields();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? t("knowledge.uploadFailed");
      notify.error(t("knowledge.uploadFailed"), detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeDocument,
    onSuccess: () => {
      notify.success(t("knowledge.deleted"));
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    },
    onError: () => {
      notify.error(t("knowledge.deleteFailed"));
    },
  });

  const reembedMutation = useMutation({
    mutationFn: reembedKnowledgeDocument,
    onSuccess: (doc) => {
      notify.success(
        "Эмбеддинги пересчитаны",
        `${doc.chunk_count} фрагментов обновлено через ${doc.embedding_model}`,
      );
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не удалось пересчитать";
      notify.error("Ошибка пересчёта", detail);
    },
  });

  const queryMutation = useMutation({
    mutationFn: queryKnowledgeBase,
    onSuccess: (response) => {
      setSearchResults(response);
    },
    onError: () => {
      notify.error(t("knowledge.queryFailed"));
    },
  });

  const docs = Array.isArray(documentsQuery.data) ? documentsQuery.data : [];
  const fakeEmbeddingDocs = docs.filter((d) => isFakeEmbedding(d.embedding_model));

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const textFormats = ["txt","md","csv","text","markdown","json","xml","yaml","yml","rst","html","htm","rtf"];
    if (textFormats.includes(ext)) {
      // Text file — read client-side, fill form
      try {
        const text = await file.text();
        const title = file.name.replace(/\.[^.]+$/, "");
        uploadForm.setFieldsValue({
          content: text,
          source_filename: file.name,
          title,
        });
        setUploadedFileName(file.name);
        notify.success(`Файл «${file.name}» загружен`, "Содержимое добавлено в форму. Нажмите «Загрузить» для сохранения.");
      } catch {
        notify.error("Ошибка чтения файла", "Не удалось прочитать содержимое файла.");
      }
    } else {
      // Binary file (PDF, DOCX, etc.) — send to server directly
      try {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const { apiClient } = await import("@/api/client");
        const resp = await apiClient.post("/api/admin/knowledge/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        notify.success(`Документ «${resp.data.title}» загружен`, `${resp.data.chunk_count} фрагментов`);
        queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
        setUploadOpen(false);
        setUploadedFileName(null);
        uploadForm.resetFields();
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Не удалось обработать файл";
        notify.error("Ошибка загрузки", detail);
      } finally {
        setUploading(false);
      }
    }
  };

  const columns: ColumnsType<KnowledgeDocumentSummary> = [
    {
      title: t("knowledge.columns.title"),
      dataIndex: "title",
      key: "title",
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
    },
    {
      title: t("knowledge.columns.type"),
      dataIndex: "source_type",
      key: "type",
      width: 100,
      render: (typeName: string) => <Tag>{typeName}</Tag>,
    },
    {
      title: t("knowledge.columns.chunks"),
      dataIndex: "chunk_count",
      key: "chunks",
      width: 100,
    },
    {
      title: t("knowledge.columns.embeddingModel"),
      dataIndex: "embedding_model",
      key: "embed",
      render: (name: string) =>
        isFakeEmbedding(name) ? (
          <Tag color="orange">{name}</Tag>
        ) : (
          <Tag color="green">{name}</Tag>
        ),
    },
    {
      title: t("knowledge.columns.uploaded"),
      dataIndex: "uploaded_at",
      key: "uploaded_at",
      width: 200,
      render: formatDate,
    },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_, doc) => (
        <Space size={0}>
          {/* Re-embed: only show for documents stuck on the fake-hash
              fallback. Pulses orange to draw attention since search on
              these docs is broken until they're re-embedded. */}
          {isFakeEmbedding(doc.embedding_model) && (
            <Tooltip title="Пересчитать эмбеддинги через текущую модель. Используйте, если документ был загружен пока сервер моделей был недоступен.">
              <Button
                type="text"
                icon={<SyncOutlined spin={reembedMutation.isPending && reembedMutation.variables === doc.id} />}
                size="small"
                onClick={() => reembedMutation.mutate(doc.id)}
                style={{ color: "#fa8c16" }}
                disabled={reembedMutation.isPending}
              />
            </Tooltip>
          )}
          <Popconfirm
            title={t("knowledge.deleteConfirm")}
            description={t("knowledge.deleteDescription")}
            onConfirm={() => deleteMutation.mutate(doc.id)}
            okText={t("common.delete")}
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("knowledge.title")}
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setUploadOpen(true)}
        >
          {t("knowledge.uploadDocument")}
        </Button>
        <Button
          icon={<SearchOutlined />}
          onClick={() => {
            setSearchOpen(true);
            setSearchResults(null);
          }}
        >
          {t("knowledge.testQuery")}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] })
          }
          loading={documentsQuery.isFetching}
        >
          {t("common.refresh")}
        </Button>
      </Space>

      <Typography.Paragraph type="secondary">
        {t("knowledge.subtitle")}
      </Typography.Paragraph>

      {fakeEmbeddingDocs.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("knowledge.fakeEmbeddingWarning", { count: fakeEmbeddingDocs.length })}
          description={t("knowledge.fakeEmbeddingDescription")}
        />
      )}

      <Table<KnowledgeDocumentSummary>
        rowKey="id"
        loading={documentsQuery.isLoading}
        columns={columns}
        dataSource={docs}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ x: "max-content" }}
      />

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        title={t("knowledge.uploadModalTitle")}
        onCancel={() => {
          setUploadOpen(false);
          setUploadedFileName(null);
        }}
        onOk={() => uploadForm.submit()}
        okText={t("knowledge.upload")}
        cancelText={t("common.cancel")}
        confirmLoading={createMutation.isPending || uploading}
        width={680}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp,.rtf,.json,.xml,.yaml,.yml,.rst,.html"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Primary action: file upload */}
        <div
          onClick={handleFileSelect}
          style={{
            border: "2px dashed #d9d9d9",
            borderRadius: 8,
            padding: "28px 16px",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.2s",
            marginBottom: 8,
            background: "#fafafa",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#EE3424"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d9d9d9"; }}
        >
          {uploading ? (
            <div>
              <Typography.Text>Обработка файла...</Typography.Text>
            </div>
          ) : uploadedFileName ? (
            <div>
              <InboxOutlined style={{ fontSize: 32, color: "#52c41a", marginBottom: 8 }} />
              <br />
              <Tag color="green" style={{ fontSize: 14, padding: "4px 12px" }}>{uploadedFileName}</Tag>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "inline-block" }}>
                Содержимое загружено в форму ниже. Нажмите «Загрузить» для сохранения.
              </Typography.Text>
            </div>
          ) : (
            <div>
              <InboxOutlined style={{ fontSize: 32, color: "#999", marginBottom: 8 }} />
              <br />
              <Typography.Text strong>Выберите файл</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                PDF, DOCX, XLSX, PPTX, ODT, TXT, MD, CSV, JSON, XML, YAML
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Бинарные файлы (PDF, DOCX и т.д.) обрабатываются автоматически
              </Typography.Text>
            </div>
          )}
        </div>

        <Divider plain style={{ margin: "16px 0" }}>
          <Typography.Text type="secondary">или введите текст вручную</Typography.Text>
        </Divider>

        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{ source_type: "text" }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="source_filename" hidden><Input /></Form.Item>
          <Form.Item name="source_type" hidden initialValue="text"><Input /></Form.Item>
          <Form.Item
            name="title"
            label={
              <span>
                {t("knowledge.documentTitle")}&nbsp;
                <Tooltip title={t("knowledge.titleTooltip")}>
                  <QuestionCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: t("knowledge.documentTitle") }]}
          >
            <Input placeholder={t("knowledge.documentTitlePlaceholder")} />
          </Form.Item>
          <Form.Item
            name="content"
            label={
              <span>
                {t("knowledge.content")}&nbsp;
                <Tooltip title={t("knowledge.contentHelp")}>
                  <QuestionCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: t("knowledge.content") }]}
          >
            <Input.TextArea
              rows={10}
              placeholder={t("knowledge.contentPlaceholder")}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test query modal */}
      <Modal
        open={searchOpen}
        title={t("knowledge.queryModalTitle")}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={720}
      >
        <Form
          form={searchForm}
          layout="vertical"
          initialValues={{ top_k: 5 }}
          onFinish={(values) => queryMutation.mutate(values)}
        >
          <Form.Item
            name="query"
            label={t("knowledge.query")}
            rules={[{ required: true, message: t("knowledge.query") }]}
          >
            <Input.TextArea rows={2} placeholder={t("knowledge.queryPlaceholder")} />
          </Form.Item>
          <Form.Item name="top_k" hidden>
            <Input type="number" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={queryMutation.isPending}
            icon={<SearchOutlined />}
          >
            {t("common.search")}
          </Button>
        </Form>

        {searchResults && (
          <div style={{ marginTop: 16 }}>
            {/* LLM answer */}
            {searchResults.answer ? (
              <div style={{
                background: "#f6ffed",
                border: "1px solid #b7eb8f",
                borderRadius: 8,
                padding: "16px 20px",
                marginBottom: 12,
              }}>
                <Typography.Paragraph style={{ marginBottom: 0, fontSize: 15 }}>
                  {searchResults.answer}
                </Typography.Paragraph>
              </div>
            ) : searchResults.matches.length === 0 ? (
              <Typography.Text type="secondary">
                {t("knowledge.noMatches")}
              </Typography.Text>
            ) : null}

            {/* Source chunks — collapsed by default, with highlighted query terms */}
            {searchResults.matches.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", color: "#999", fontSize: 13, userSelect: "none" }}>
                  Источники ({searchResults.matches.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  {searchResults.matches.map((m) => (
                    <details key={m.chunk_id} style={{ marginBottom: 6 }}>
                      <summary style={{
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#666",
                        padding: "4px 0",
                        userSelect: "none",
                      }}>
                        {m.document_title} · #{m.chunk_idx} · {m.distance.toFixed(4)}
                      </summary>
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "#fafafa",
                          borderRadius: 6,
                          border: "1px solid #f0f0f0",
                          fontSize: 12,
                          lineHeight: 1.6,
                          marginTop: 4,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: highlightCitations(m.text, searchResults.citations ?? []),
                        }}
                      />
                    </details>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
