import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/store/auth";
import type { UserRole } from "@/types";

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  tester: 1,
  admin: 2,
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole) {
    const userRank = ROLE_RANK[user.role];
    const requiredRank = ROLE_RANK[requireRole];
    if (userRank < requiredRank) {
      return <Navigate to="/runs" replace />;
    }
  }

  return <>{children}</>;
}
