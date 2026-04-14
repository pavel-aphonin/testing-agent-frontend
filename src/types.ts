// Mirror of the backend Pydantic schemas. Keep in sync with
// testing-agent-backend/app/schemas/*.py

export type UserRole = "viewer" | "tester" | "admin";

export interface CurrentUser {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  role: UserRole;
  must_change_password: boolean;
}

export interface AdminUser extends CurrentUser {}

export interface AdminUserCreate {
  email: string;
  password: string;
  role: UserRole;
  must_change_password: boolean;
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
}

// ----------------------------------------------------------------- Scenarios

export interface ScenarioRead {
  id: string;
  title: string;
  description: string | null;
  steps_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface ScenarioCreate {
  title: string;
  description?: string;
  steps_json: Record<string, unknown>;
}

export interface ScenarioUpdate {
  title?: string;
  description?: string;
  steps_json?: Record<string, unknown>;
  is_active?: boolean;
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
}

export interface TestDataUpdate {
  key?: string;
  value?: string;
  category?: string;
  description?: string;
}
