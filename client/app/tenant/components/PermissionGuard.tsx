"use client";

import { ReactNode, useEffect, useRef, useMemo } from "react";
import { usePermissions } from "@/app/hooks/usePermissions";
import { Card } from "@/app/components/ui/Card";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { Button } from "rizzui";
import { useRouter } from "next/navigation";

/**
 * Permission action types
 */
type PermissionAction = "read" | "write" | "delete";

/**
 * Props for PermissionGuard component
 */
interface PermissionGuardProps {
  section: string;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode; // Custom fallback UI (optional)
  redirectTo?: string; // Redirect path if no permission (optional)
}

/**
 * PermissionGuard Component
 *
 * Protects routes/components based on user permissions.
 * Shows "Access Denied" if user doesn't have permission.
 *
 * Usage:
 * <PermissionGuard section="employees" action="read">
 *   <EmployeesPage />
 * </PermissionGuard>
 */
export default function PermissionGuard({
  section,
  action,
  children,
  fallback,
  redirectTo,
}: PermissionGuardProps) {
  const {
    hasPermission,
    isLoading,
    hasFullAccess,
    isEmployeeContext,
    permissions: permissionsMap,
  } = usePermissions();
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Check permission - use permissionsMap directly if available, fallback to hasPermission
  // Use useMemo to ensure consistent calculation
  // IMPORTANT: Only calculate hasAccess when permissions are fully loaded
  const hasAccess = useMemo(() => {
    // Full access users always have access
    if (hasFullAccess) {
      return true;
    }

    // CRITICAL: Check if permissionsMap is empty (not just null/undefined)
    // An empty object {} means permissions haven't loaded yet
    const hasPermissionsData =
      permissionsMap && Object.keys(permissionsMap).length > 0;

    // If still loading OR permissions map is empty, return undefined
    // This means we can't determine access yet - wait for permissions to load
    if (isLoading || !hasPermissionsData) {
      return undefined; // Indeterminate state - wait for permissions
    }

    // Check directly from permissions map (works even if isEmployeeContext is false)
    if (permissionsMap[section]) {
      return permissionsMap[section][action] === true;
    }

    // If section not in permissions map, try fallback to hasPermission
    // But only if we're in employee context (hasPermission requires it)
    if (isEmployeeContext) {
      return hasPermission(section, action);
    }

    // If not in employee context and section not in map, no access
    return false;
  }, [
    hasFullAccess,
    isLoading,
    permissionsMap,
    section,
    action,
    hasPermission,
    isEmployeeContext,
  ]);

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === "development") {
    const hasPermissionsData =
      permissionsMap && Object.keys(permissionsMap).length > 0;
    console.log("[PermissionGuard] Permission Check:", {
      section,
      action,
      hasAccess,
      hasFullAccess,
      isEmployeeContext,
      isLoading,
      hasPermissionsData,
      permissionsMapKeys: permissionsMap ? Object.keys(permissionsMap) : [],
      permissionsMapLength: permissionsMap
        ? Object.keys(permissionsMap).length
        : 0,
      sectionPermissions: permissionsMap?.[section],
      permissionsMapType: typeof permissionsMap,
    });
  }

  // Handle redirect in useEffect (not during render)
  // Only redirect if we're sure permissions are loaded AND user doesn't have access
  useEffect(() => {
    // Don't redirect if:
    // 1. Still loading permissions
    // 2. Access is indeterminate (undefined) - wait for permissions to load
    // 3. User has access
    // 4. No redirect path specified
    // 5. Already redirected
    if (isLoading) {
      hasRedirected.current = false; // Reset flag while loading
      return; // Wait for permissions to load
    }

    // If hasAccess is undefined, permissions are not ready yet - don't redirect
    if (hasAccess === undefined) {
      hasRedirected.current = false; // Reset flag while waiting
      return; // Wait for permissions to be determined
    }

    // User has access - don't redirect
    if (hasAccess === true) {
      hasRedirected.current = false; // Reset flag if access is granted
      return; // User has access, don't redirect
    }

    // At this point, hasAccess is explicitly false and permissions are loaded
    // Only redirect if redirect path is specified and we haven't already redirected
    if (!redirectTo || hasRedirected.current) {
      return; // No redirect path or already redirected
    }

    // Only redirect if we're certain user doesn't have access
    // (hasAccess is false AND permissions are loaded)
    hasRedirected.current = true;
    router.replace(redirectTo);
  }, [isLoading, hasAccess, redirectTo, router]);

  // Reset redirect flag when section or action changes
  useEffect(() => {
    hasRedirected.current = false;
  }, [section, action]);

  // Show loading state while checking permissions
  // Also show loading if hasAccess is undefined (permissions not determined yet)
  if (isLoading || hasAccess === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If no permission (hasAccess is explicitly false), show access denied or redirect
  if (hasAccess === false) {
    // If redirect path is provided, show loading while redirecting
    if (redirectTo) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Redirecting...</p>
          </div>
        </div>
      );
    }

    // If custom fallback is provided, show it
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default access denied UI
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-12 max-w-md">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldExclamationIcon className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-6">
              You don&apos;t have permission to access this section.
              {isEmployeeContext && (
                <span className="block mt-2 text-sm">
                  Please contact your administrator to request access.
                </span>
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/tenant/dashboard")}
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Permission granted, render children
  return <>{children}</>;
}
