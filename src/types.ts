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
