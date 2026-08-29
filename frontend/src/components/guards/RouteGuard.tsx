import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { parseJwtPayload } from '@/lib/jwt';

interface RouteGuardProps {
  allowedRoles?: string[];
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ allowedRoles }) => {
  const { isHydrated, isAuthenticated, user, accessToken } = useAuthStore();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    let role = user?.role;
    if (!role && accessToken) {
      const jwtData = parseJwtPayload(accessToken);
      role = jwtData?.role || jwtData?.role_name;
    }

    const isGlobalAdmin = role === 'super_admin' || role === 'clinic_admin';
    if (!isGlobalAdmin && (!role || !allowedRoles.includes(role))) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
};
