import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppSelector } from "@/app/store/hook";
import axiosInstance from "@/app/lib/axios";

/**
 * Permission action types
 */
type PermissionAction = "read" | "write" | "delete";

/**
 * Permission structure for a section
 */
interface SectionPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
}

/**
 * Permissions map: sectionKey -> permissions
 */
interface PermissionsMap {
  [sectionKey: string]: SectionPermissions;
}

/**
 * Data access levels map: sectionKey -> level (1-7)
 */
interface DataAccessLevelsMap {
  [sectionKey: string]: number;
}

/**
 * Employee permissions response
 */
interface EmployeePermissionsResponse {
  aggregatedRoles: {
    roleIds: string[];
    isSystemAdmin: boolean;
    aggregatedRoles: Array<{
      roleId: string;
      name: string;
      color?: string;
      level?: number;
    }>;
  };
  permissions: {
    permissions: PermissionsMap;
    dataAccessLevels: DataAccessLevelsMap;
    accessibleSections: string[];
  };
}

/**
 * Hook to manage and check employee permissions
 *
 * Usage:
 * const { hasPermission, permissions, isLoading } = usePermissions();
 *
 * if (hasPermission("employees", "read")) {
 *   // Show employees page
 * }
 */
export function usePermissions() {
  const { user } = useAppSelector((state) => state.auth);
  const [permissionsData, setPermissionsData] =
    useState<EmployeePermissionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is in employee context (has activeAssignment and is employee)
  const isEmployeeContext = useMemo(() => {
    if (!user) return false;
    const role = user.activeAssignment?.role || user.role;
    return role === "employee" && !!user.activeAssignment;
  }, [user]);

  // Check if user is tenant-owner or admin (they have full access)
  const hasFullAccess = useMemo(() => {
    if (!user) return false;
    const role = user.activeAssignment?.role || user.role;
    return role === "tenant-owner" || role === "admin" || user.isPlatformAdmin;
  }, [user]);

  // Track if we've loaded permissions for the current context
  const loadedContextRef = useRef<string | null>(null);

  // Fetch permissions when in employee context
  const fetchPermissions = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!isEmployeeContext || !user?.activeAssignment) {
        setPermissionsData(null);
        loadedContextRef.current = null;
        return;
      }

      // Create a unique key for this context
      const contextKey = `${user.activeAssignment.tenantId}:${user.activeAssignment.branchId}`;
      const isNewContext = loadedContextRef.current !== contextKey;

      // On initial load (new context) or force refresh, always fetch fresh permissions
      // Don't use cached data to ensure we get the latest permissions
      const shouldUseCache = !isNewContext && !forceRefresh;

      // Check if permissions are stored in sessionStorage (only use if same context and not forcing refresh)
      if (shouldUseCache) {
        const storedPermissions = sessionStorage.getItem(
          `permissions:${contextKey}`
        );

        if (storedPermissions) {
          try {
            const parsed = JSON.parse(storedPermissions);
            setPermissionsData(parsed);
            // Mark that we've loaded for this context
            loadedContextRef.current = contextKey;
            setIsLoading(false);
            return;
          } catch (err) {
            console.error("Failed to parse stored permissions", err);
            sessionStorage.removeItem(`permissions:${contextKey}`);
          }
        }
      }

      // Set loading to true before fetching
      setIsLoading(true);
      setError(null);

      try {
        // Always fetch fresh permissions from backend
        const res = await axiosInstance.post(
          "/auth/switch-organization-context",
          {
            branchId: user.activeAssignment.branchId,
          }
        );

        if (res.data.data) {
          // Store in sessionStorage for quick access
          sessionStorage.setItem(
            `permissions:${contextKey}`,
            JSON.stringify(res.data.data)
          );
          setPermissionsData(res.data.data);
          // Mark that we've loaded for this context
          loadedContextRef.current = contextKey;
        } else {
          setPermissionsData(null);
        }
      } catch (err: any) {
        console.error("Failed to fetch permissions", err);
        setError(err?.response?.data?.message || "Failed to fetch permissions");
        setPermissionsData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [isEmployeeContext, user]
  );

  // Load permissions when context changes
  useEffect(() => {
    if (isEmployeeContext) {
      // Set loading to true immediately when context changes
      // This prevents components from checking permissions before they're loaded
      setIsLoading(true);
      fetchPermissions();
    } else {
      setPermissionsData(null);
      setIsLoading(false);
    }
  }, [isEmployeeContext, fetchPermissions]);

  /**
   * Check if user has permission for a specific section and action
   */
  const hasPermission = useCallback(
    (section: string, action: PermissionAction): boolean => {
      // Platform admins, tenant owners, and admins have full access
      if (hasFullAccess) {
        return true;
      }

      // If not in employee context, deny access (strict check)
      if (!isEmployeeContext) {
        return false;
      }

      // If permissions are still loading, deny access (strict check)
      if (!permissionsData || isLoading) {
        return false;
      }

      // System admin has full access
      if (permissionsData.aggregatedRoles.isSystemAdmin) {
        return true;
      }

      // Check permission for the section
      let sectionPermissions = permissionsData.permissions.permissions[section];

      // Backward compatibility: If checking "job-titles" and not found, also check "positions"
      // This handles cases where permissions were saved with the old "positions" key
      if (!sectionPermissions && section === "job-titles") {
        sectionPermissions =
          permissionsData.permissions.permissions["positions"];
        if (sectionPermissions && process.env.NODE_ENV === "development") {
          console.warn(
            "[usePermissions] Found permissions under old 'positions' key. Please re-save permissions in RBAC page to use 'job-titles'."
          );
        }
      }

      // Backward compatibility: If checking "config-documents" and not found, also check "documents"
      // This handles cases where permissions were saved with the old "documents" key
      if (!sectionPermissions && section === "config-documents") {
        sectionPermissions =
          permissionsData.permissions.permissions["documents"];
        if (sectionPermissions && process.env.NODE_ENV === "development") {
          console.warn(
            "[usePermissions] Found permissions under old 'documents' key. Please re-save permissions in RBAC page to use 'config-documents'."
          );
        }
      }

      // Debug logging for job-titles
      if (process.env.NODE_ENV === "development" && section === "job-titles") {
        console.log("[usePermissions] Checking job-titles permission:", {
          section,
          action,
          sectionPermissions,
          hasSectionPermissions: !!sectionPermissions,
          allSections: Object.keys(permissionsData.permissions.permissions),
          foundUnderPositions:
            !!permissionsData.permissions.permissions["positions"],
        });
      }

      if (!sectionPermissions) {
        // No permissions defined for this section = no access
        return false;
      }

      // Strict check: permission must be explicitly true
      return sectionPermissions[action] === true;
    },
    [hasFullAccess, isEmployeeContext, permissionsData, isLoading]
  );

  /**
   * Get data access level for a section
   */
  const getDataAccessLevel = useCallback(
    (section: string): number => {
      if (hasFullAccess || permissionsData?.aggregatedRoles.isSystemAdmin) {
        return 7; // Highest level
      }

      if (!permissionsData) {
        return 1; // Default level
      }

      return permissionsData.permissions.dataAccessLevels[section] || 1;
    },
    [hasFullAccess, permissionsData]
  );

  /**
   * Get all accessible sections
   */
  const accessibleSections = useMemo(() => {
    if (hasFullAccess || permissionsData?.aggregatedRoles.isSystemAdmin) {
      // Return all sections (we don't have a list, so return empty array for now)
      return [];
    }

    return permissionsData?.permissions.accessibleSections || [];
  }, [hasFullAccess, permissionsData]);

  /**
   * Set permissions (called after context switch)
   */
  const setPermissions = useCallback(
    (data: EmployeePermissionsResponse | null) => {
      setPermissionsData(data);

      // Also store in sessionStorage for persistence
      if (data && user?.activeAssignment) {
        sessionStorage.setItem(
          `permissions:${user.activeAssignment.tenantId}:${user.activeAssignment.branchId}`,
          JSON.stringify(data)
        );
      } else if (!data && user?.activeAssignment) {
        // Clear stored permissions if setting to null
        sessionStorage.removeItem(
          `permissions:${user.activeAssignment.tenantId}:${user.activeAssignment.branchId}`
        );
      }
    },
    [user]
  );

  return {
    hasPermission,
    getDataAccessLevel,
    accessibleSections,
    permissions: permissionsData?.permissions.permissions || {},
    dataAccessLevels: permissionsData?.permissions.dataAccessLevels || {},
    aggregatedRoles: permissionsData?.aggregatedRoles || null,
    isLoading,
    error,
    isEmployeeContext,
    hasFullAccess,
    setPermissions, // Allow external setting (e.g., from context switch response)
    refetch: fetchPermissions,
  };
}
