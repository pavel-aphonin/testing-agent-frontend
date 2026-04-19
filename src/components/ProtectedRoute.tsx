import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/store/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require a specific permission code, e.g. "runs.create". */
  requirePermission?: string;
  /** Legacy: require a minimum role. Mapped to permissions for compat. */
  requireRole?: string;
}

/** Maps old role slugs to the permission checked on the route guard. */
const LEGACY_ROLE_TO_PERM: Record<string, string> = {
  viewer: "runs.view",
  tester: "runs.create",
  admin: "users.manage",
};

export function ProtectedRoute({
  children,
  requirePermission,
  requireRole,
}: ProtectedRouteProps) {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const perms = new Set(user.permissions ?? []);

  // Permission-based check (new style)
  if (requirePermission && !perms.has(requirePermission)) {
    return <Navigate to="/runs" replace />;
  }

  // Legacy role-based check — translate to permission
  if (requireRole) {
    const perm = LEGACY_ROLE_TO_PERM[requireRole];
    if (perm && !perms.has(perm)) {
      return <Navigate to="/runs" replace />;
    }
  }

  return <>{children}</>;
}
