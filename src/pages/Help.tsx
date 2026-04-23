import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BugOutlined,
  BulbOutlined,
  FireOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate, useParams } from "react-router-dom";

import {
  getHelpArticle,
  listHelpArticles,
  listHelpSections,
  popularHelpArticles,
  submitFeedback,
} from "@/api/help";
import type { FeedbackKind, HelpArticleSummary, HelpSectionInfo } from "@/types";
import { notify } from "@/utils/notify";

/**
 * Help portal modelled after Apple / Google help sites.
 *
 * Two URL states:
 *   /help              — landing (search + popular + sections)
 *   /help/<slug>       — single article
 *
 * Feedback form is a modal triggered from the CTA at the bottom of every
 * page. All tickets go into the ``feedback_tickets`` table and surface
 * in the admin inbox (see FeedbackInbox page).
 */
export function HelpPage() {
  const { slug } = useParams<{ slug?: string }>();
  if (slug) return <ArticleView slug={slug} />;
  return <HelpLanding />;
}

// ═══ Landing ═══════════════════════════════════════════════════════════════

function HelpLanding() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const sectionsQ = useQuery({
    queryKey: ["help-sections"],
    queryFn: listHelpSections,
    staleTime: 10 * 60 * 1000,
  });
  const articlesQ = useQuery({
    queryKey: ["help-articles", "all"],
    queryFn: () => listHelpArticles(),
    staleTime: 5 * 60 * 1000,
  });
  const popularQ = useQuery({
    queryKey: ["help-popular"],
    queryFn: () => popularHelpArticles(6),
    staleTime: 5 * 60 * 1000,
  });

  // Live client-side filter — we already have the whole list in memory
  // (it's small); no need to round-trip the server for each keystroke.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (articlesQ.data ?? []).filter((a) => {
      return (
        a.title.toLowerCase().includes(needle) ||
        (a.excerpt ?? "").toLowerCase().includes(needle)
      );
    });
  }, [q, articlesQ.data]);

  const bySection = useMemo(() => {
    const m = new Map<string, HelpArticleSummary[]>();
    for (const a of articlesQ.data ?? []) {
      if (!m.has(a.section)) m.set(a.section, []);
      m.get(a.section)!.push(a);
    }
    return m;
  }, [articlesQ.data]);

  return (
    <>
      <style>{`
        .help-page { max-width: 1100px; margin: 0 auto; }
        .help-hero {
          text-align: center; padding: 40px 24px 32px;
          background: linear-gradient(160deg, #fff3f3 0%, #fff 80%);
          border-radius: 20px; border: 1px solid #f0dcda;
          margin-bottom: 28px;
        }
        .help-hero h1 { font-size: 32px; font-weight: 600; letter-spacing: -0.6px; margin: 0 0 6px; }
        .help-hero p { color: #595959; font-size: 15px; margin: 0 0 22px; }
        .help-search {
          max-width: 560px; margin: 0 auto;
        }
        .help-search .ant-input-affix-wrapper {
          border-radius: 999px !important; padding: 10px 18px;
          box-shadow: 0 2px 10px rgba(0,0,0,.05);
        }

        .help-section-title {
          font-size: 20px; font-weight: 600; letter-spacing: -0.3px;
          margin: 32px 0 14px; display: flex; align-items: center; gap: 10px;
        }

        .help-card {
          border: 1px solid #ececec; border-radius: 14px;
          padding: 18px; background: #fff; cursor: pointer;
          transition: all .18s ease; height: 100%;
        }
        .help-card:hover { border-color: #EE3424; transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(238,52,36,.07); }
        .help-card .article-title { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
        .help-card .article-excerpt {
          color: #595959; font-size: 13px; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .help-card .article-meta { margin-top: 10px; font-size: 11.5px; color: #8c8c8c; }

        .help-section-card {
          border: 1px solid #ececec; border-radius: 14px;
          padding: 22px; background: #fff; cursor: pointer;
          transition: all .18s ease;
        }
        .help-section-card:hover { border-color: #EE3424; background: #fff3f3; }
        .help-section-card .sec-icon { font-size: 28px; margin-bottom: 10px; }
        .help-section-card .sec-title {
          font-size: 17px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.2px;
        }
        .help-section-card .sec-count { color: #8c8c8c; font-size: 12.5px; }

        .cta-feedback {
          margin-top: 40px; padding: 28px 30px;
          background: #fafafa; border-radius: 16px; border: 1px solid #ececec;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap;
        }
        .cta-feedback h3 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
        .cta-feedback p { color: #595959; margin: 0; font-size: 13px; }

        .row-grid-3 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .row-grid-4 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
      `}</style>

      <div className="help-page">
        <div className="help-hero">
          <h1>Справочный центр</h1>
          <p>Ответы на вопросы о работе с Марковом — от первого запуска до разработки расширений.</p>
          <div className="help-search">
            <Input
              size="large"
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              placeholder="Поиск по названию или содержанию статьи…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              allowClear
            />
          </div>
        </div>

        {q.trim() ? (
          <SearchResults nav={nav} articles={filtered} query={q} />
        ) : (
          <>
            {(popularQ.data?.length ?? 0) > 0 && (
              <section>
                <h2 className="help-section-title">
                  <FireOutlined style={{ color: "#EE3424" }} /> Популярные статьи
                </h2>
                <div className="row-grid-3">
                  {(popularQ.data ?? []).map((a) => (
                    <ArticleCard key={a.id} article={a} onOpen={() => nav(`/help/${a.slug}`)} />
                  ))}
                </div>
              </section>
            )}

            {(sectionsQ.data?.length ?? 0) > 0 && (
              <section>
                <h2 className="help-section-title">Разделы</h2>
                <div className="row-grid-4">
                  {(sectionsQ.data ?? []).map((s: HelpSectionInfo) => {
                    const count = bySection.get(s.key)?.length ?? 0;
                    return (
                      <div
                        key={s.key}
                        className="help-section-card"
                        onClick={() => nav(`/help?section=${s.key}`)}
                      >
                        <div className="sec-icon">{s.icon}</div>
                        <h4 className="sec-title">{s.label}</h4>
                        <div className="sec-count">
                          {count > 0 ? `${count} ${plural(count, ["статья", "статьи", "статей"])}` : "нет статей"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(sectionsQ.data ?? []).map((s: HelpSectionInfo) => {
              const list = bySection.get(s.key) ?? [];
              if (list.length === 0) return null;
              return (
                <section key={s.key}>
                  <h2 className="help-section-title">
                    <span>{s.icon}</span> {s.label}
                  </h2>
                  <div className="row-grid-3">
                    {list.map((a) => (
                      <ArticleCard key={a.id} article={a} onOpen={() => nav(`/help/${a.slug}`)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        <div className="cta-feedback">
          <div>
            <h3><BulbOutlined style={{ color: "#EE3424", marginRight: 8 }} />Не нашли ответ?</h3>
            <p>Напишите нам — мы читаем каждое обращение. Баги, вопросы, предложения — всё пригодится.</p>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              onClick={() => setFeedbackOpen(true)}
            >
              Написать обращение
            </Button>
          </Space>
        </div>

        {(articlesQ.isLoading || sectionsQ.isLoading) && (
          <div style={{ textAlign: "center", marginTop: 40 }}><Spin /></div>
        )}
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

function SearchResults({
  nav,
  articles,
  query,
}: {
  nav: ReturnType<typeof useNavigate>;
  articles: HelpArticleSummary[];
  query: string;
}) {
  if (articles.length === 0) {
    return (
      <Empty
        description={`По запросу «${query}» ничего не найдено`}
        style={{ marginTop: 48 }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  return (
    <section>
      <h2 className="help-section-title">
        Результаты поиска <Typography.Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
          — найдено {articles.length}
        </Typography.Text>
      </h2>
      <div className="row-grid-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} onOpen={() => nav(`/help/${a.slug}`)} />
        ))}
      </div>
    </section>
  );
}

function ArticleCard({
  article,
  onOpen,
}: {
  article: HelpArticleSummary;
  onOpen: () => void;
}) {
  return (
    <div className="help-card" onClick={onOpen}>
      <h4 className="article-title">{article.title}</h4>
      <div className="article-excerpt">{article.excerpt ?? ""}</div>
      <div className="article-meta">
        {article.views_28d > 0 && (
          <span>
            <FireOutlined style={{ color: "#EE3424" }} /> {article.views_28d}
            {" "}за месяц
          </span>
        )}
      </div>
    </div>
  );
}

// ═══ Single article ════════════════════════════════════════════════════════

function ArticleView({ slug }: { slug: string }) {
  const nav = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const articleQ = useQuery({
    queryKey: ["help-article", slug],
    queryFn: () => getHelpArticle(slug),
  });

  if (articleQ.isLoading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }
  if (articleQ.isError || !articleQ.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Статья не найдена"
        description="Возможно, её переименовали или удалили."
        action={<Button onClick={() => nav("/help")}>Вернуться в справку</Button>}
      />
    );
  }

  const a = articleQ.data;
  return (
    <>
      <style>{`
        .help-article { max-width: 760px; margin: 0 auto; padding: 0 4px; }
        .help-article h1 { font-size: 28px; font-weight: 600; margin: 12px 0 10px; letter-spacing: -0.4px; }
        .help-article .article-meta { color: #8c8c8c; font-size: 13px; margin-bottom: 24px; }
        .help-article .md h1, .help-article .md h2, .help-article .md h3 {
          font-weight: 600; letter-spacing: -0.2px; margin: 22px 0 8px;
        }
        .help-article .md h1 { font-size: 22px; }
        .help-article .md h2 { font-size: 18px; }
        .help-article .md h3 { font-size: 15px; color: #595959; }
        .help-article .md p  { line-height: 1.7; margin: 10px 0; }
        .help-article .md ul, .help-article .md ol { line-height: 1.7; padding-left: 24px; }
        .help-article .md li { margin: 4px 0; }
        .help-article .md code {
          background: #f5f5f5; padding: 1px 5px; border-radius: 4px;
          font-size: 12.5px; color: #c41d7f;
        }
        .help-article .md pre {
          background: #fafafa; border: 1px solid #f0f0f0; padding: 14px 16px;
          border-radius: 8px; overflow-x: auto; font-size: 12.5px; line-height: 1.55;
        }
        .help-article .md pre code { background: transparent; padding: 0; color: inherit; }
        .help-article .md a { color: #EE3424; }
        .help-article .md blockquote {
          border-left: 3px solid #EE3424; padding-left: 12px; color: #595959; margin: 10px 0;
        }
      `}</style>

      <div className="help-article">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => nav("/help")}
          style={{ marginBottom: 12, padding: "4px 8px" }}
        >
          Вся справка
        </Button>
        <h1>{a.title}</h1>
        <div className="article-meta">
          {a.views_28d > 0 && <><FireOutlined style={{ color: "#EE3424" }} /> {a.views_28d} просмотров за месяц · </>}
          обновлено {new Date(a.updated_at ?? a.created_at).toLocaleDateString("ru-RU")}
        </div>
        <div className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.body_md}</ReactMarkdown>
        </div>

        <div className="cta-feedback" style={{ marginTop: 48 }}>
          <div>
            <h3><QuestionCircleOutlined style={{ color: "#EE3424", marginRight: 8 }} />Статья помогла?</h3>
            <p>Если нет — опишите, чего не хватает. Мы дополним или ответим лично.</p>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => setFeedbackOpen(true)}
            >
              Написать обращение
            </Button>
            <Button onClick={() => nav("/help")}>
              К другим статьям <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      </div>

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        context={{ article_slug: slug, url: window.location.pathname }}
      />
    </>
  );
}

// ═══ Feedback modal ════════════════════════════════════════════════════════

function FeedbackModal({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context?: Record<string, unknown>;
}) {
  const [form] = Form.useForm<{ kind: FeedbackKind; subject: string; body: string }>();
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: (values: { kind: FeedbackKind; subject: string; body: string }) =>
      submitFeedback({ ...values, context }),
    onSuccess: () => {
      notify.success("Спасибо! Обращение отправлено, мы ответим вам на почту.");
      form.resetFields();
      onClose();
      qc.invalidateQueries({ queryKey: ["feedback-inbox"] });
    },
    onError: (e: any) =>
      notify.error(e?.response?.data?.detail ?? "Не удалось отправить"),
  });

  return (
    <Modal
      title={<><BugOutlined style={{ color: "#EE3424", marginRight: 8 }} />Обращение в поддержку</>}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Отправить"
      cancelText="Отмена"
      confirmLoading={m.isPending}
      width={560}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ kind: "question" }}
        onFinish={(v) => m.mutate(v)}
      >
        <Form.Item name="kind" label="Тип обращения">
          <Radio.Group>
            <Radio.Button value="bug">Баг</Radio.Button>
            <Radio.Button value="question">Вопрос</Radio.Button>
            <Radio.Button value="proposal">Предложение</Radio.Button>
            <Radio.Button value="other">Другое</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="subject"
          label="Тема"
          rules={[
            { required: true, message: "Укажите короткую тему" },
            { min: 3, max: 300 },
          ]}
        >
          <Input placeholder="Например: не запускается исследование на iPhone 17 Pro Max" />
        </Form.Item>
        <Form.Item
          name="body"
          label="Описание"
          rules={[{ required: true, message: "Опишите ситуацию" }, { min: 5 }]}
        >
          <Input.TextArea
            rows={6}
            placeholder="Что вы делали, что ожидали, что произошло. Приложите по возможности шаги воспроизведения и версию браузера."
          />
        </Form.Item>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Обращения попадают к администраторам Маркова. Позже мы синхронизируем их в Jira.
        </Typography.Text>
      </Form>
    </Modal>
  );
}

// ═══ Helpers ═══════════════════════════════════════════════════════════════

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return forms[2];
  if (m10 === 1) return forms[0];
  if (m10 >= 2 && m10 <= 4) return forms[1];
  return forms[2];
}
