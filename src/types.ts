// Mirror of the backend Pydantic schemas. Keep in sync with
// testing-agent-backend/app/schemas/*.py

/** Legacy role code. Kept for backward compat; new code checks permissions. */
export type UserRole = string;

export interface CurrentUser {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  role: string;
  role_id: string | null;
  role_name: string;
  role_code: string;
  permissions: string[];
  must_change_password: boolean;
  /** Relative path under app_uploads_dir; null = default circle with
   *  the first letter of the email. */
  avatar_path: string | null;
}

export interface AdminUser extends CurrentUser {}

export interface AdminUserCreate {
  email: string;
  password: string;
  role_id: string;
  must_change_password: boolean;
}

// ---- RBAC Roles ----

export interface RoleRead {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
  parent_id: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface RoleCreate {
  name: string;
  code: string;
  description?: string;
  permissions: string[];
  parent_id?: string | null;
  is_group?: boolean;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permissions?: string[];
  parent_id?: string | null;
}

export interface PermissionMeta {
  ru: string;
  en: string;
}

export interface SectionMeta {
  label_ru: string;
  label_en: string;
  permissions: Record<string, PermissionMeta>;
}

export interface PermissionsRegistry {
  sections: Record<string, SectionMeta>;
}

// ---- Workspaces ----

export interface WorkspaceBrief {
  id: string;
  code: string;
  name: string;
  logo_path: string | null;
}

export interface WorkspaceRead extends WorkspaceBrief {
  description: string | null;
  is_archived: boolean;
  parent_id: string | null;
  is_group: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string | null;
}

// ---- Notification Types (system + workspace settings) ----

export interface NotificationTypeRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  template: string | null;
  is_system: boolean;
  parent_id: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationTypeCreate {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  template?: string | null;
  parent_id?: string | null;
  is_group?: boolean;
}

export interface NotificationTypeUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  template?: string | null;
  parent_id?: string | null;
}

export interface WorkspaceNotificationSettingRead {
  id: string;
  workspace_id: string;
  notification_type_id: string;
  is_enabled: boolean;
}

// ---- Custom Dictionaries (per-workspace) ----

export type CustomDictionaryKind = "linear" | "hierarchical";

export interface CustomDictionaryRead {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string | null;
  kind: CustomDictionaryKind;
  is_restricted: boolean;
  parent_id: string | null;
  is_group: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CustomDictionaryCreate {
  workspace_id: string;
  code: string;
  name: string;
  description?: string;
  kind?: CustomDictionaryKind;
  is_restricted?: boolean;
  parent_id?: string | null;
  is_group?: boolean;
}

export interface CustomDictionaryUpdate {
  name?: string;
  description?: string;
  is_restricted?: boolean;
  parent_id?: string | null;
}

export interface CustomDictionaryItemRead {
  id: string;
  dictionary_id: string;
  code: string | null;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_group: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface CustomDictionaryItemCreate {
  code?: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  is_group?: boolean;
  sort_order?: number;
}

export interface CustomDictionaryItemUpdate {
  code?: string;
  name?: string;
  description?: string;
  parent_id?: string | null;
  sort_order?: number;
}

export interface CustomDictionaryPermissionRead {
  id: string;
  dictionary_id: string;
  user_id: string;
  user_email: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
}

// ---- Attributes ----

export type AttributeDataType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "date"
  | "link"
  | "member";
export type AttributeScope = "workspace" | "user";

export interface AttributeRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
  data_type: AttributeDataType;
  enum_values: string[] | null;
  default_value: unknown;
  scope: AttributeScope;
  applies_to: string;
  is_system: boolean;
  is_required: boolean;
  source_dictionary_id: string | null;
  parent_id: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AttributeCreate {
  code: string;
  name: string;
  description?: string;
  data_type: AttributeDataType;
  enum_values?: string[] | null;
  default_value?: unknown;
  scope?: AttributeScope;
  applies_to?: string;
  is_required?: boolean;
  source_dictionary_id?: string | null;
  parent_id?: string | null;
  is_group?: boolean;
}

export interface AttributeUpdate {
  name?: string;
  description?: string;
  enum_values?: string[] | null;
  default_value?: unknown;
  is_required?: boolean;
  source_dictionary_id?: string | null;
  parent_id?: string | null;
}

export interface AttributeValueRead {
  id: string;
  attribute_id: string;
  entity_type: "workspace" | "user_workspace";
  entity_id: string;
  value: unknown;
  updated_at: string | null;
}

export interface WorkspaceMemberRead {
  id: string;
  workspace_id: string;
  user_id: string;
  user_email: string;
  role: string;
  joined_at: string;
}

// ---- Apps / extensions ----

export type AppApprovalStatus = "draft" | "pending" | "approved" | "rejected";

export interface AppManifestSlot {
  slot: string;
  label: string;
  icon?: string | null;
  path?: string;
}

export interface AppManifestSetting {
  code: string;
  name: string;
  type: "string" | "text" | "number" | "boolean" | "secret" | "enum";
  enum_values?: string[] | null;
  required?: boolean;
  default?: unknown;
  /** Tooltip text shown when the user hovers the "?" icon next to the field. */
  description?: string;
  /** Optional section label. Fields sharing a group render together. */
  group?: string | null;
}

export interface AppManifestScreenshot {
  path: string;
  caption?: string | null;
}

export interface AppManifest {
  code: string;
  version: string;
  name: string;
  description?: string;
  category?: string;
  author?: string;
  permissions_required?: string[];
  role_required?: string[];
  ui_slots?: AppManifestSlot[];
  settings_schema?: AppManifestSetting[];
  hooks?: { event: string; handler: string }[];
  screenshots?: AppManifestScreenshot[];
}

export interface AppPackageRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  author: string | null;
  logo_path: string | null;
  cover_path: string | null;
  is_public: boolean;
  owner_workspace_id: string | null;
  approval_status: AppApprovalStatus;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  latest_version: string | null;
  install_count: number;
  avg_rating: number | null;
  review_count: number;
}

export interface AppPackageVersionRead {
  id: string;
  app_package_id: string;
  version: string;
  manifest: AppManifest;
  bundle_path: string;
  changelog: string | null;
  size_bytes: number;
  is_deprecated: boolean;
  created_at: string;
}

export interface AppInstallationUserPrefs {
  /** Hide the app's sidebar slot(s) from MY view. Admin still sees it. */
  hidden_from_sidebar?: boolean;
  /** Hide the app's top_bar slot(s) from MY view. */
  hidden_from_top_bar?: boolean;
  /** Extensible — unknown keys are preserved. */
  [key: string]: unknown;
}

/** Per-theme-mode color palette. All fields optional; missing ones
 *  fall back to the built-in Markov defaults on the frontend.
 *  Semantic colors (success/warning/error/info) are NOT here — those
 *  are defined via dedicated dictionaries (defect priorities,
 *  notification types, etc.). */
export interface ThemeModeTokens {
  /** Accent — buttons, active states, highlights. */
  colorPrimary?: string | null;
  /** Link color in prose. */
  colorLink?: string | null;
  /** Link under hover. */
  colorLinkHover?: string | null;
  /** Card / table / modal surface. */
  colorBgContainer?: string | null;
  /** Page wash behind cards. */
  colorBgLayout?: string | null;
  /** Sidebar panel background. */
  sidebarBg?: string | null;
  /** Sidebar item on hover. */
  sidebarItemHoverBg?: string | null;
  /** Sidebar item when selected (= current route). */
  sidebarItemSelectedBg?: string | null;
}

/** Full AntD-compatible token blob we allow customization of. */
export interface ThemeTokens {
  light?: ThemeModeTokens;
  dark?: ThemeModeTokens;
  borderRadius?: number | null;
  fontFamily?: string | null;
  /** Base font size in px. Default 14. */
  fontSize?: number | null;
}

export interface BrandingRead {
  product_name: string | null;
  short_name: string | null;
  logo_path: string | null;
  logo_back_path: string | null;
  favicon_path: string | null;
  theme_tokens: ThemeTokens | null;
  updated_at: string;
}

// ───── Dashboards ─────────────────────────────────────────────────────

export type WidgetType =
  // Every user-visible variant from ApexCharts' "Chart Types" docs
  // plus our own ``table``. Some of these collapse to the same Apex
  // ``type`` prop under the hood (bar vs barHorizontal, mixed via
  // per-series types, funnel via ``plotOptions.bar.isFunnel``) —
  // see WidgetRenderer for how each is actually drawn.
  | "line"
  | "bar"            // column (vertical bars)
  | "barHorizontal"  // horizontal bars
  | "area"
  | "rangeArea"      // two-line band
  | "mixed"          // line + column combo
  | "pie"
  | "donut"
  | "radialBar"
  | "polarArea"
  | "radar"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "treemap"
  | "boxplot"
  | "candlestick"
  | "rangeBar"       // timeline
  | "funnel"
  | "table"
  // Native (non-ApexCharts) widgets
  | "stat"           // single KPI number with optional trend indicator
  | "progress"       // progress bar toward a target
  | "sparkline"      // compact trend line with no axes, usually with KPI
  // Phase 3b — user-authored iframe widgets
  | "custom";

export interface DashboardWidgetRead {
  id: string;
  dashboard_id: string;
  widget_type: WidgetType;
  title: string;
  datasource_code: string | null;
  datasource_params: Record<string, unknown> | null;
  chart_options: Record<string, unknown> | null;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
}

export interface DashboardSummary {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_system: boolean;
  owner_user_id: string | null;
  sort_order: number;
  can_edit: boolean;
}

export interface DashboardFull extends DashboardSummary {
  widgets: DashboardWidgetRead[];
}

export interface WidgetTemplateRead {
  id: string;
  workspace_id: string;
  author_user_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  widget_type: WidgetType;
  datasource_code: string | null;
  datasource_params: Record<string, unknown> | null;
  chart_options: Record<string, unknown> | null;
  default_w: number;
  default_h: number;
  created_at: string;
}

// Phase 3b — custom widget packages
export interface WidgetPackageRead {
  id: string;
  workspace_id: string;
  author_user_id: string | null;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  version: string;
  manifest: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface WidgetPackageSource {
  id: string;
  code: string;
  version: string;
  manifest: Record<string, unknown>;
  /** Published HTML — this is what dashboards render. */
  html_source: string;
  /** Work-in-progress edits, null when no draft exists. */
  draft_html_source?: string | null;
  /** True when draft exists and differs from html_source. */
  has_draft?: boolean;
}

export interface WidgetPackageCreate {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  version?: string;
  manifest?: Record<string, unknown>;
  html_source: string;
  is_active?: boolean;
}

export interface WidgetPackageUpdate {
  name?: string;
  description?: string | null;
  icon?: string | null;
  version?: string;
  manifest?: Record<string, unknown>;
  /** Edits routed to the draft buffer by the backend. */
  html_source?: string;
  /** Pass null to discard the current draft (revert to published). */
  draft_html_source?: string | null;
  is_active?: boolean;
}

export interface DatasourceMetadata {
  code: string;
  name: string;
  description: string;
  kind: "categorical" | "timeseries" | "tabular";
  /** Group key — ``runs`` / ``defects`` / etc. Used for <optgroup>. */
  group?: string;
  params?: { code: string; type: "number" | "string"; default: unknown }[];
}

export interface WidgetDataResponse {
  categories?: string[];
  series?: { name: string; data: number[] }[];
  is_tabular?: boolean;
  columns?: { code: string; name: string }[];
  rows?: unknown[][];
  error?: string;
}

export interface ReleaseNoteSummary {
  id: string;
  version: string;
  title: string;
  excerpt: string | null;
  released_at: string;
  is_published: boolean;
  dismissed: boolean;
}

export interface ReleaseNoteFull extends ReleaseNoteSummary {
  body_md: string;
  created_at: string;
  updated_at: string | null;
}

export interface ReleaseNotesUnread {
  unread_count: number;
  latest: ReleaseNoteSummary | null;
}

export type AppAuditAction =
  | "installed"
  | "version_changed"
  | "settings_changed"
  | "enabled"
  | "disabled"
  | "uninstalled";

export interface AppInstallationAuditRead {
  id: string;
  workspace_id: string;
  app_package_id: string | null;
  installation_id: string | null;
  package_name: string | null;
  action: AppAuditAction;
  from_version: string | null;
  to_version: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

export type HelpSectionKey =
  | "getting_started"
  | "runs"
  | "scenarios"
  | "apps"
  | "admin"
  | "api"
  | "troubleshooting";

export interface HelpSectionInfo {
  key: HelpSectionKey;
  label: string;
  icon: string;
}

export interface HelpArticleSummary {
  id: string;
  slug: string;
  title: string;
  section: HelpSectionKey;
  excerpt: string | null;
  sort_order: number;
  views_28d: number;
  updated_at: string | null;
  created_at: string;
}

export interface HelpArticleFull extends HelpArticleSummary {
  body_md: string;
}

export type FeedbackKind = "bug" | "question" | "proposal" | "other";
export type FeedbackStatus = "new" | "in_progress" | "closed";

export interface FeedbackSubmit {
  kind: FeedbackKind;
  subject: string;
  body: string;
  context?: Record<string, unknown>;
}

export interface FeedbackTicketRead {
  id: string;
  user_id: string | null;
  user_email: string | null;
  kind: FeedbackKind;
  subject: string;
  body: string;
  context: Record<string, unknown> | null;
  status: FeedbackStatus;
  external_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AppInstallationRead {
  id: string;
  workspace_id: string;
  app_package_id: string;
  version_id: string;
  settings: Record<string, unknown> | null;
  is_enabled: boolean;
  installed_by_user_id: string | null;
  installed_at: string;
  updated_at: string | null;
  package: AppPackageRead | null;
  version: AppPackageVersionRead | null;
  /** Current user's per-installation UI toggles. Empty object = defaults. */
  user_prefs: AppInstallationUserPrefs;
}

export interface AppReviewRead {
  id: string;
  app_package_id: string;
  user_id: string;
  user_email: string;
  rating: number;
  text: string | null;
  created_at: string;
  updated_at: string | null;
}

// ---- Notifications + Invitations ----

export interface NotificationRead {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface InvitationRead {
  id: string;
  workspace_id: string;
  workspace_name: string;
  inviter_email: string;
  invitee_user_id: string;
  role: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

export type RunMode = "ai" | "mc" | "hybrid";
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Run {
  id: string;
  user_id: string;
  title: string | null;
  bundle_id: string;
  device_id: string;
  platform: string;
  mode: RunMode;
  status: RunStatus;
  max_steps: number;
  c_puct: number;
  rollout_depth: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  stats_json: Record<string, unknown> | null;
  // V2 auto-provisioning fields
  device_type: string | null;
  os_version: string | null;
  // PER-40 / PER-41: replay metadata. NULL on regular runs.
  replay_of?: string | null;
  started_from_screen_hash?: string | null;
  app_file_path: string | null;
}

export interface RunCreate {
  bundle_id: string;
  device_id: string;
  platform?: string;
  mode?: RunMode;
  max_steps?: number;
  c_puct?: number;
  rollout_depth?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// ----------------------------------------------------------------- LLM models

export interface LLMModelPublic {
  id: string;
  name: string;
  family: string;
  description: string | null;
  context_length: number;
  quantization: string;
  supports_vision: boolean;
  supports_tool_use: boolean;
}

export interface LLMModelAdmin extends LLMModelPublic {
  gguf_path: string;
  mmproj_path: string | null;
  size_bytes: number;
  default_temperature: number;
  default_top_p: number;
  benchmark_tps: number | null;
  benchmark_ttft_ms: number | null;
  is_active: boolean;
  uploaded_by_user_id: string | null;
  uploaded_at: string;
  notes: string | null;
}

export interface LLMModelCreate {
  name: string;
  description?: string | null;
  family: string;
  gguf_path: string;
  mmproj_path?: string | null;
  size_bytes?: number;
  context_length?: number;
  quantization: string;
  supports_vision?: boolean;
  supports_tool_use?: boolean;
  default_temperature?: number;
  default_top_p?: number;
  is_active?: boolean;
  notes?: string | null;
}

export interface LLMModelUpdate {
  description?: string | null;
  is_active?: boolean;
  default_temperature?: number;
  default_top_p?: number;
  benchmark_tps?: number;
  benchmark_ttft_ms?: number;
  notes?: string | null;
}

// ---------------------------------------------------- HuggingFace model browser

export interface HfRepoSummary {
  repo_id: string;
  downloads: number | null;
  likes: number | null;
  last_modified: string | null;
  library_name: string | null;
  tags: string[];
}

export interface HfFile {
  filename: string;
  size_bytes: number | null;
}

export interface HfDownloadRequest {
  repo_id: string;
  filename: string;
  mmproj_filename?: string | null;
  name: string;
  description?: string | null;
  family: string;
  context_length: number;
  quantization: string;
  supports_vision: boolean;
  supports_tool_use: boolean;
  default_temperature?: number;
  default_top_p?: number;
}

export interface HfDownloadStarted {
  download_id: string;
}

// Events streamed over /ws/admin/downloads/{id}
export type HfDownloadEvent =
  | {
      type: "download_started";
      download_id: string;
      repo_id: string;
      filename: string;
      mmproj_filename: string | null;
    }
  | {
      type: "progress";
      download_id: string;
      file: string;
      downloaded: number;
      total: number | null;
    }
  | {
      type: "download_complete";
      download_id: string;
      model_id: string;
      model_name: string;
      size_bytes: number;
    }
  | { type: "download_failed"; download_id: string; error: string };

// --------------------------------------------------------------- Agent settings

export type GraphLibrary = "react-flow" | "cytoscape" | "vis-network";
export type Language = "en" | "ru";

/** PER-39: data-overlay modes for the StateGraph. ``default`` keeps
 *  the existing neutral styling; the others colour nodes by run
 *  metadata so the user spots problem zones at a glance. */
export type GraphOverlayMode =
  | "default"
  | "defects"
  | "spec"
  | "visits"
  | "diff";

/** Per-node visual override produced by the overlay layer. Renderers
 *  fall back to their built-in defaults when a key is undefined. */
export interface NodeOverlayStyle {
  /** Border color (hex). */
  borderColor?: string;
  /** Background fill (hex). */
  bgColor?: string;
  /** Short text shown as a corner badge — e.g. "3" for defect count. */
  badgeText?: string;
  /** Badge background color (hex). */
  badgeColor?: string;
}

export interface AgentSettings {
  id: string;
  user_id: string;
  default_mode: RunMode;
  default_llm_model_id: string | null;
  default_max_steps: number;
  c_puct: number;
  rollout_depth: number;
  graph_library: GraphLibrary;
  language: Language;
  vision_model_id: string | null;
  thinking_model_id: string | null;
  instruct_model_id: string | null;
  coder_model_id: string | null;
  rag_enabled: boolean;
  /** Personal theme overrides — merged on top of system branding at
   *  render time. Same shape as BrandingRead.theme_tokens. */
  theme_overrides: ThemeTokens | null;
  /** Built-in sidebar nav keys the user has hidden for themselves. */
  hidden_nav_items: string[] | null;
}

export interface AgentSettingsUpdate {
  default_mode?: RunMode;
  default_llm_model_id?: string | null;
  default_max_steps?: number;
  c_puct?: number;
  rollout_depth?: number;
  graph_library?: GraphLibrary;
  language?: Language;
  vision_model_id?: string | null;
  thinking_model_id?: string | null;
  instruct_model_id?: string | null;
  coder_model_id?: string | null;
  rag_enabled?: boolean;
  theme_overrides?: ThemeTokens | null;
  hidden_nav_items?: string[] | null | undefined;
}

// ----------------------------------------------------------------- Scenarios

export interface ScenarioRead {
  id: string;
  title: string;
  description: string | null;
  steps_json: Record<string, unknown>;
  is_active: boolean;
  /** PER-35: knowledge document IDs that scope this scenario's RAG
   *  verification. Null/empty = whole workspace corpus. */
  rag_document_ids?: string[] | null;
  created_at: string;
}

export interface ScenarioCreate {
  title: string;
  description?: string;
  steps_json: Record<string, unknown>;
  workspace_id?: string | null;
  rag_document_ids?: string[] | null;
}

export interface ScenarioUpdate {
  title?: string;
  description?: string;
  steps_json?: Record<string, unknown>;
  is_active?: boolean;
  rag_document_ids?: string[] | null;
}

// ---------------------------------------------------------------------- Profile

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// ----------------------------------------------------------------- Run results

export interface RunScreenSummary {
  id: number;
  screen_id_hash: string;
  name: string;
  visit_count: number;
  screenshot_path: string | null;
  first_seen_at: string;
}

export interface RunEdgeSummary {
  id: number;
  source_screen_hash: string;
  target_screen_hash: string;
  action_type: string;
  action_details_json: Record<string, unknown> | null;
  success: boolean;
  step_idx: number;
  /** Timeline (PER-25): relative paths under app_uploads_dir.
   *  Use the /api/runs/{id}/edges/{edge_id}/screenshot?side=before|after
   *  endpoint to fetch the actual PNGs. */
  screenshot_before_path?: string | null;
  screenshot_after_path?: string | null;
  /** One-line LLM rationale for picking this action; null in MC mode
   *  and on edges produced by the deterministic scenario runner. */
  llm_reasoning?: string | null;
  /** PER-36: RAG verification verdict for the destination screen.
   *  Null when RAG was disabled or unreachable for this step. */
  rag_verdict_json?: {
    matched: boolean;
    score: number;
    snippet: string;
    document_id?: string | null;
    document_title?: string | null;
  } | null;
  created_at: string;
}

export interface RunResults {
  run: Run;
  screens: RunScreenSummary[];
  edges: RunEdgeSummary[];
}

// ------------------------------------------------------------ App upload

export interface AppUploadResponse {
  upload_id: string;
  bundle_id: string;
  app_name: string;
  platform: "ios" | "android";
}

// -------------------------------------------------------- Device configs

export interface DeviceConfigRead {
  id: string;
  platform: "ios" | "android";
  device_type: string;
  device_identifier: string;
  os_version: string;
  os_identifier: string;
  is_active: boolean;
  created_at: string;
}

export interface DeviceConfigCreate {
  platform: "ios" | "android";
  device_type: string;
  device_identifier: string;
  os_version: string;
  os_identifier: string;
}

export interface SimulatorRuntime {
  name: string;
  identifier: string;
  platform: "ios" | "android";
}

export interface SimulatorDeviceType {
  name: string;
  identifier: string;
  platform: "ios" | "android";
}

export interface SimulatorConfig {
  runtimes: SimulatorRuntime[];
  device_types: SimulatorDeviceType[];
}

// ------------------------------------------------------------ Run V2

export interface RunCreateV2 {
  title?: string;
  app_file_id: string;
  device_config_id: string;
  mode?: RunMode;
  max_steps?: number;
  c_puct?: number;
  rollout_depth?: number;
  scenario_ids?: string[];
  pbt_enabled?: boolean;
  workspace_id?: string | null;
  /** attribute_id → value. Backend writes to AttributeValue rows. */
  attribute_values?: Record<string, unknown>;
}

// ----------------------------------------------------------------- Knowledge

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  source_filename: string | null;
  source_type: string;
  embedding_model: string;
  embedding_dim: number;
  chunk_count: number;
  uploaded_by_user_id: string;
  uploaded_at: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentSummary {
  content: string;
}

export interface KnowledgeDocumentCreate {
  title: string;
  source_type: "text" | "markdown";
  content: string;
  source_filename?: string | null;
}

export interface KnowledgeQuery {
  query: string;
  top_k?: number;
}

export interface KnowledgeMatch {
  document_id: string;
  document_title: string;
  chunk_id: string;
  chunk_idx: number;
  text: string;
  distance: number;
}

export interface KnowledgeQueryResponse {
  embedding_model: string;
  matches: KnowledgeMatch[];
}

// ----------------------------------------------------------------- Test data

export interface TestDataRead {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
}

export interface TestDataCreate {
  key: string;
  value: string;
  category?: string;
  description?: string;
  workspace_id?: string | null;
}

export interface TestDataUpdate {
  key?: string;
  value?: string;
  category?: string;
  description?: string;
}
