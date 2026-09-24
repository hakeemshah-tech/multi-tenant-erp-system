// app/tenant/layout.tsx

// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { getProfile } from "../store/slices/authSlice";
// import Sidebar from "./components/Sidebar";
// import Header from "../components/shared/Header"; // 👈 Import Header
// import { useAppDispatch, useAppSelector } from "../store/hook";

// export default function TenantLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const dispatch = useAppDispatch();
//   const router = useRouter();
//   const { user } = useAppSelector((state) => state.auth);

//   useEffect(() => {
//     console.log(user, "please");

//     if (!user) dispatch(getProfile());
//     else if (user.role !== "tenant-owner") router.push("/login");
//   }, [user, dispatch, router]);

//   return (
//     <div className="flex h-screen">
//       <Sidebar />
//       <div className="flex-1 flex flex-col overflow-hidden">
//         <Header /> {/* 👈 Top header bar */}
//         <main className="flex-1 bg-gray-50 overflow-auto p-6">{children}</main>
//       </div>
//     </div>
//   );
// }
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getProfile } from "../store/slices/authSlice";
import Sidebar from "./components/Sidebar";
import Header from "../components/shared/Header";
import { useAppDispatch, useAppSelector } from "../store/hook";
import { usePermissions } from "../hooks/usePermissions";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAppSelector((state) => state.auth);
  const {
    hasPermission,
    hasFullAccess,
    isEmployeeContext,
    isLoading: isLoadingPermissions,
    permissions: permissionsMap,
  } = usePermissions();

  // Route to permission section mapping
  // These must match the section keys used in RBAC and the sidebar menuItemToSectionMap
  const routeToSectionMap: { [path: string]: string } = {
    "/tenant/dashboard": "dashboard",
    "/tenant/employees": "employees",
    "/tenant/recruitment": "recruitment",
    "/tenant/recruitment/contract-approvals": "contracts", // Contract Approvals under recruitment
    "/tenant/audit": "audits",
    "/tenant/notifications": "notifications",
    "/tenant/my-contract-approvals": "my-contract-approvals",
    // Contract routes - templates, types, etc.
    "/tenant/contracts": "contracts",
    // Configuration routes - use actual section keys from sidebar mapping
    "/tenant/departments": "departments",
    "/tenant/job-titles": "job-titles",
    "/tenant/configs/fields": "fields",
    "/tenant/configs/documents": "config-documents",
    "/tenant/configs/contracts": "contracts",
    "/tenant/configs/industry-awards": "industry-awards",
    "/tenant/configs/industry-details": "organisation-details",
    "/tenant/configs/payroll-settings": "payroll-settings",
    "/tenant/configs/rbac": "rbac",
    "/tenant/configs/role-levels": "role-levels",
    "/tenant/configs/employment-settings": "employment-settings",
    "/tenant/configs/personal-settings": "personal-settings",
  };

  useEffect(() => {
    if (!user) {
      dispatch(getProfile());
      return;
    }

    const roles = user.assignments?.map((a) => a.role) || [];
    const isEmployeeProfileCreated = user?.isEmployeeProfileCreated;
    const currentMode = user?.currentMode;
    const userRole = user.activeAssignment?.role || user.role;

    // Pages accessible to all authenticated users
    const publicPages = [
      "/tenant/my-contract-approvals",
      "/tenant/notifications",
    ];

    // Admin-only pages (tenant-owner and admin only)
    const adminOnlyPages = [
      "/tenant/dashboard",
      "/tenant/recruitment",
      "/tenant/employees",
      "/tenant/audit",
      "/tenant/configs",
      "/tenant/departments",
      "/tenant/job-titles",
      "/tenant/contracts",
    ];

    // Check if current path is a public page
    const isPublicPage = publicPages.some(
      (page) => pathname === page || pathname?.startsWith(`${page}/`)
    );

    // Check if current path is an admin-only page
    const isAdminOnlyPage = adminOnlyPages.some(
      (page) => pathname === page || pathname?.startsWith(`${page}/`)
    );

    // If user is tenant-owner or admin, allow all access
    if (
      roles.includes("tenant-owner") ||
      userRole === "admin" ||
      hasFullAccess
    ) {
      return;
    }

    // If accessing a public page, allow access
    if (isPublicPage) {
      return;
    }

    // For employees, check permissions
    // Check if user is in employee context (either by role or by having assignments)
    const isEmployee =
      isEmployeeContext ||
      userRole === "employee" ||
      roles.includes("employee") ||
      isEmployeeProfileCreated === true ||
      currentMode === "nexus-profile";

    if (isEmployee) {
      // Wait for permissions to load before checking
      // This prevents redirecting during page refresh while permissions are loading
      // Also wait if we don't have permissions data yet (might still be loading)
      // BUT: if user has full access, don't wait (they don't need permissions)
      const hasPermissionsData =
        permissionsMap && Object.keys(permissionsMap).length > 0;

      if (!hasFullAccess && (isLoadingPermissions || !hasPermissionsData)) {
        console.log(
          "[Tenant Layout] Employee detected, waiting for permissions...",
          {
            pathname,
            isLoadingPermissions,
            hasPermissionsMap: !!permissionsMap,
            hasPermissionsData,
            permissionsMapKeys: permissionsMap
              ? Object.keys(permissionsMap)
              : [],
            hasFullAccess,
          }
        );
        return; // Don't redirect while loading - wait for permissions to load
      }

      // Find the permission section for this route
      let requiredSection: string | null = null;

      // Check exact path first
      if (routeToSectionMap[pathname || ""]) {
        requiredSection = routeToSectionMap[pathname || ""];
      } else {
        // Check if path starts with any mapped route (for nested routes)
        for (const [route, section] of Object.entries(routeToSectionMap)) {
          if (pathname?.startsWith(route)) {
            requiredSection = section;
            break;
          }
        }
      }

      // If we found a required section, check permission
      if (requiredSection) {
        // CRITICAL: If permissions are still loading or not available, DO NOT redirect
        // Wait for permissions to load before making any access decisions
        // Check if permissionsMap is null, undefined, or empty object
        const hasPermissionsData =
          permissionsMap && Object.keys(permissionsMap).length > 0;

        if (isLoadingPermissions || !hasPermissionsData) {
          console.log("[Tenant Layout] Waiting for permissions to load...", {
            pathname,
            requiredSection,
            isLoadingPermissions,
            hasPermissionsMap: !!permissionsMap,
            permissionsMapKeys: permissionsMap
              ? Object.keys(permissionsMap)
              : [],
            hasPermissionsData,
          });
          return; // Wait - don't redirect while loading
        }

        let hasAccess = false;

        // Full access users bypass all checks
        if (hasFullAccess) {
          hasAccess = true;
        } else {
          // Check permissions directly from the permissions map
          // This works regardless of isEmployeeContext status
          if (permissionsMap[requiredSection]) {
            hasAccess = permissionsMap[requiredSection].read === true;
          } else {
            // If permissions map doesn't have the section, try hasPermission as fallback
            // This will work if isEmployeeContext is true
            // BUT: Only use fallback if we're sure permissions are loaded
            if (isEmployeeContext) {
              hasAccess = hasPermission(requiredSection, "read");
            } else {
              // Not in employee context and section not in map = no access
              hasAccess = false;
            }
          }
        }

        // Debug logging (remove in production)
        if (process.env.NODE_ENV === "development") {
          console.log("[Tenant Layout] Permission Check:", {
            pathname,
            requiredSection,
            hasAccess,
            hasFullAccess,
            isEmployeeContext,
            isLoadingPermissions,
            permissionsMapKeys: permissionsMap
              ? Object.keys(permissionsMap)
              : [],
            sectionPermissions: permissionsMap?.[requiredSection],
            sectionExistsInMap: permissionsMap
              ? !!permissionsMap[requiredSection]
              : false,
            permissionsMapType: typeof permissionsMap,
            permissionsMapIsEmpty: permissionsMap
              ? Object.keys(permissionsMap).length === 0
              : true,
          });
        }

        // ONLY redirect if we're CERTAIN user doesn't have access
        // (hasAccess is explicitly false AND permissions are loaded)
        if (hasAccess === false) {
          console.warn("[Tenant Layout] Access denied, redirecting...", {
            pathname,
            requiredSection,
            sectionPermissions: permissionsMap?.[requiredSection],
            permissionsMapKeys: permissionsMap
              ? Object.keys(permissionsMap)
              : [],
          });
          // No permission, redirect to contract approvals
          router.replace("/tenant/my-contract-approvals");
          return;
        }

        // Permission granted, allow access - EXIT EARLY
        // IMPORTANT: Exit here to prevent any further redirect logic from running
        if (process.env.NODE_ENV === "development") {
          console.log("[Tenant Layout] ✅ Access granted - EXITING EARLY", {
            pathname,
            requiredSection,
            hasAccess,
            sectionPermissions: permissionsMap?.[requiredSection],
          });
        }
        return;
      } else {
        // No section mapping found - check if it's a public page
        // If it's not a public page and no mapping exists, we need to be more careful
        // For admin-only pages without mappings, check permissions first
        if (isAdminOnlyPage) {
          // Wait for permissions to load before making decision
          if (
            isLoadingPermissions ||
            !permissionsMap ||
            Object.keys(permissionsMap).length === 0
          ) {
            console.log(
              "[Tenant Layout] Admin-only page, waiting for permissions...",
              {
                pathname,
                isLoadingPermissions,
                hasPermissionsMap: !!permissionsMap,
              }
            );
            return; // Wait for permissions
          }

          // If it's an admin-only page but no section mapping, deny access
          // BUT: Only if user is an employee (non-employees might have different access)
          if (isEmployee) {
            console.warn(
              "[Tenant Layout] Admin-only page without section mapping, redirecting employee...",
              {
                pathname,
              }
            );
            router.replace("/tenant/my-contract-approvals");
            return;
          }
        }
        // For other routes without mappings, allow access (they might be handled elsewhere)
        return;
      }
    }

    // Legacy check: If employee/Nexus profile tries to access admin-only page without permission check
    // Only run this if the user is NOT in employee context (to avoid double-checking)
    // This is a fallback for cases where employee detection might have failed
    // BUT: Skip this if user is an employee (they should have been handled above)
    if (isAdminOnlyPage && !isEmployee) {
      if (
        isEmployeeProfileCreated === true ||
        roles.includes("employee") ||
        currentMode === "nexus-profile"
      ) {
        // This should not happen if permissions are set up correctly, but as a fallback
        // Redirect to nexus-profile or contract approvals
        router.replace("/tenant/my-contract-approvals");
        return;
      }
    }

    // Handle other cases - ONLY if user is NOT an employee (employees are handled above)
    // This is for users who are not employees but might need special handling
    if (!isEmployee) {
      if (currentMode === "newbie") {
        // 🚧 Redirect to onboarding
        router.replace("/onboarding");
        return;
      } else if (
        isEmployeeProfileCreated === true ||
        roles.includes("employee") ||
        currentMode === "nexus-profile"
      ) {
        // 👷 Redirect to contract approvals (safe page for employees)
        router.replace("/tenant/my-contract-approvals");
        return;
      } else {
        // ❌ Fallback
        router.replace("/login");
        return;
      }
    }
    // If we reach here and user is employee, they should have been handled above
    // Don't redirect - allow access
  }, [
    user,
    dispatch,
    router,
    pathname,
    hasPermission,
    hasFullAccess,
    isEmployeeContext,
    isLoadingPermissions,
    permissionsMap, // Add permissionsMap to dependencies
  ]);

  // Check if we're on a template page
  const isTemplatePage = pathname?.includes("/tenant/contracts/templates/");

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main
          className={`flex-1 bg-gray-50 overflow-auto p-6 ${
            isTemplatePage ? "!pt-0" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
