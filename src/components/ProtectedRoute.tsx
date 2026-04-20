import { Navigate, useLocation } from "react-router-dom";

import { NoAccess } from "@/pages/NoAccess";
import { useAuthStore } from "@/store/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePermission?: string;
  requireRole?: string;
}

/** Old role hierarchy for fallback when permissions haven't loaded yet. */
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  tester: 1,
  moderator: 2,
  admin: 3,
};

const LEGACY_ROLE_TO_PERM: Record<string, string> = {
  viewer: "runs.view",
  tester: "runs.create",
  // users.view is admin-only (moderator/tester don't have it)
  admin: "users.view",
};

const PERM_TO_MIN_ROLE: Record<string, string> = {
  "runs.view": "viewer",
  "runs.create": "tester",
  "users.view": "admin",
  "users.create": "admin",
  "users.edit": "admin",
  "users.delete": "admin",
  "dictionaries.view": "admin",
  "dictionaries.create": "admin",
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

  const perms = user.permissions;
  const hasPerms = Array.isArray(perms) && perms.length > 0;
  const permsSet = new Set(perms ?? []);

  // If permissions are loaded, use them. Otherwise fall back to role hierarchy.
  if (requirePermission) {
    if (hasPerms) {
      if (!permsSet.has(requirePermission)) {
        return <NoAccess />;
      }
    } else {
      // Fallback: map permission to minimum role
      const minRole = PERM_TO_MIN_ROLE[requirePermission] ?? "admin";
      const userRank = ROLE_RANK[user.role] ?? 0;
      const requiredRank = ROLE_RANK[minRole] ?? 3;
      if (userRank < requiredRank) {
        return <NoAccess />;
      }
    }
  }

  if (requireRole) {
    if (hasPerms) {
      const perm = LEGACY_ROLE_TO_PERM[requireRole];
      if (perm && !permsSet.has(perm)) {
        return <NoAccess />;
      }
    } else {
      const userRank = ROLE_RANK[user.role] ?? 0;
      const requiredRank = ROLE_RANK[requireRole] ?? 3;
      if (userRank < requiredRank) {
        return <NoAccess />;
      }
    }
  }

  return <>{children}</>;
}
