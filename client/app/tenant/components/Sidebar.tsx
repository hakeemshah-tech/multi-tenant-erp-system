"use client";

import { cn } from "@/app/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/store/hook";
import { logoutUser, getProfile } from "@/app/store/slices/authSlice";
import {
  Home,
  Users,
  Logs,
  Settings,
  UserCog,
  LogOut,
  ChevronDown,
  ChevronRight,
  Building,
  Pin,
  PinOff,
  Bell,
  UserPlus,
  FileText,
  Folder,
  FileSignature,
  Trophy,
  DollarSign,
  CheckCircle2,
  Briefcase,
  Shield,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import axiosInstance from "@/app/lib/axios";
import { usePermissions } from "@/app/hooks/usePermissions";
import { useOrganizations } from "@/app/hooks/useOrganizations";
import toast from "react-hot-toast";

/* -------------------- Types -------------------- */
type IconType = React.ComponentType<{ size?: number; className?: string }>;

type NavLeaf = {
  key: string;
  label: string;
  href: string;
  icon?: IconType;
};

type NavGroup = {
  key: string;
  label: string;
  icon?: IconType;
  baseHref?: string; // used to determine active state for the group (eg. "/tenant/configs")
  children: NavItem[];
};

type NavItem = NavLeaf | NavGroup;

const isGroup = (item: NavItem): item is NavGroup =>
  (item as NavGroup).children !== undefined;

/* -------------------- Config (scalable) -------------------- */
const navConfig: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: Home,
    href: "/tenant/dashboard",
  },
  {
    key: "recruitment",
    label: "Recruitment",
    icon: UserPlus,
    baseHref: "/tenant/recruitment",
    children: [
      {
        key: "recruitment-applicants",
        label: "Applicants",
        href: "/tenant/recruitment/applicants",
      },
      {
        key: "recruitment-bulk-import",
        label: "Bulk Import (Test)",
        icon: FileText,
        href: "/tenant/recruitment/bulk-import",
      },
    ],
  },
  {
    key: "employees",
    label: "Employees",
    icon: Users,
    href: "/tenant/employees",
  },
  {
    key: "contract-approvals",
    label: "Contract Approvals",
    icon: CheckCircle2,
    href: "/tenant/recruitment/contract-approvals",
  },
  {
    key: "my-contract-approvals",
    label: "My Contract Approvals",
    icon: FileSignature,
    href: "/tenant/my-contract-approvals",
  },
  {
    key: "audits",
    label: "Audit Trail",
    icon: Logs,
    href: "/tenant/audit",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: Bell,
    href: "/tenant/notifications",
  },

  // Parent "Configurations" with children
  {
    key: "configs",
    label: "Configurations",
    icon: Settings,
    baseHref: "/tenant/configs",
    children: [
      {
        key: "departments",
        label: "Departments",
        icon: Building,
        href: "/tenant/departments",
      },
      {
        key: "positions",
        label: "Job Titles",
        icon: UserCog,
        href: "/tenant/job-titles",
      },
      {
        key: "fields",
        label: "Fields",
        icon: FileText,
        href: "/tenant/configs/fields",
      },
      {
        key: "documents",
        label: "Documents",
        icon: Folder,
        href: "/tenant/configs/documents",
      },
      {
        key: "contracts",
        label: "Contracts",
        icon: FileSignature,
        href: "/tenant/configs/contracts",
      },
      {
        key: "industry-awards",
        label: "Industry Awards",
        icon: Trophy,
        href: "/tenant/configs/industry-awards",
      },
      {
        key: "industry-details",
        label: "Organisation Details",
        icon: Building,
        href: "/tenant/configs/industry-details",
      },
      {
        key: "payroll-settings",
        label: "Payroll Settings",
        icon: DollarSign,
        href: "/tenant/configs/payroll-settings",
      },
      {
        key: "rbac",
        label: "Role Management",
        icon: Shield,
        href: "/tenant/configs/rbac",
      },
      {
        key: "role-levels",
        label: "Role Level Management",
        icon: Layers,
        href: "/tenant/configs/role-levels",
      },
      {
        key: "employment-settings",
        label: "Employment Settings",
        icon: Briefcase,
        href: "/tenant/configs/employment-settings",
      },
      {
        key: "personal-settings",
        label: "Personal Settings",
        icon: UserCog,
        href: "/tenant/configs/personal-settings",
      },

      // add more children here anytime…
    ],
  },
];

/* -------------------- Permission-based Access Control -------------------- */

/**
 * Mapping of sidebar menu items to permission sections
 * This maps each menu item key to the corresponding permission section
 * NOTE: Section keys must match exactly what's stored in the backend (from RBAC page)
 */
const menuItemToSectionMap: { [key: string]: string } = {
  dashboard: "dashboard",
  recruitment: "recruitment",
  "recruitment-applicants": "recruitment",
  "recruitment-bulk-import": "recruitment",
  employees: "employees",
  "contract-approvals": "contract-approvals", // Top-level contract approvals (separate from recruitment)
  "generate-contract": "generate-contract", // Permission for Generate Contract button in Employee details
  "my-contract-approvals": "my-contract-approvals",
  audits: "audits",
  notifications: "notifications",
  configs: "configurations", // Parent section for all config items
  departments: "departments", // Matches RBAC section key
  positions: "job-titles", // RBAC uses "job-titles", not "positions"
  fields: "fields", // Matches RBAC section key
  documents: "config-documents", // RBAC uses "config-documents", not "documents"
  contracts: "contracts", // Matches RBAC section key
  "industry-awards": "industry-awards", // Matches RBAC section key
  "industry-details": "organisation-details", // RBAC uses "organisation-details", not "industry-details"
  "payroll-settings": "payroll-settings", // Matches RBAC section key
  rbac: "rbac", // Matches RBAC section key (if exists)
  "role-levels": "role-levels", // Matches RBAC section key (if exists)
  "employment-settings": "employment-settings", // Matches RBAC section key (if exists)
  "personal-settings": "personal-settings", // Matches RBAC section key (if exists)
};

/**
 * Determines which sidebar items are visible based on permissions
 * Returns true if the item should be visible, false otherwise
 */
const isItemVisibleForPermission = (
  item: NavItem,
  hasPermission: (
    section: string,
    action: "read" | "write" | "delete"
  ) => boolean,
  hasFullAccess: boolean
): boolean => {
  const itemKey = item.key;

  // If user has full access (tenant-owner/admin), show all items
  if (hasFullAccess) {
    return true;
  }

  // For groups, check if any child is visible first
  // This allows parent groups to show if any child has permission
  if (isGroup(item)) {
    const hasVisibleChild = item.children.some((child) =>
      isItemVisibleForPermission(child, hasPermission, hasFullAccess)
    );

    // If any child is visible, show the group
    if (hasVisibleChild) {
      return true;
    }

    // Also check if the parent group itself has permission
    const section = menuItemToSectionMap[itemKey];
    if (section) {
      const hasParentAccess = hasPermission(section, "read");
      if (hasParentAccess) {
        return true;
      }
    }

    // No child visible and no parent permission = don't show
    return false;
  }

  // For non-group items, check permission normally
  const section = menuItemToSectionMap[itemKey];

  // Debug logging for positions/job-titles
  if (process.env.NODE_ENV === "development" && itemKey === "positions") {
    console.log("[Sidebar] Checking positions item:", {
      itemKey,
      section,
      hasSectionMapping: !!section,
    });
  }

  // If no section mapping, don't show (strict check - only show if explicitly mapped)
  if (!section) {
    // Only allow unmapped items if user has full access
    return hasFullAccess;
  }

  // Check if user has read permission for this section
  const hasAccess = hasPermission(section, "read");

  // Debug logging for positions/job-titles
  if (process.env.NODE_ENV === "development" && itemKey === "positions") {
    console.log("[Sidebar] Positions permission result:", {
      itemKey,
      section,
      hasAccess,
      hasFullAccess,
    });
  }

  // If no direct access, don't show (strict check)
  if (!hasAccess) {
    return false;
  }

  return true; // Has access, show the item
};

/**
 * Filters navigation items based on permissions
 */
const filterNavItemsByPermission = (
  items: NavItem[],
  hasPermission: (
    section: string,
    action: "read" | "write" | "delete"
  ) => boolean,
  hasFullAccess: boolean
): NavItem[] => {
  return items
    .filter((item) =>
      isItemVisibleForPermission(item, hasPermission, hasFullAccess)
    )
    .map((item) => {
      if (isGroup(item)) {
        // Filter children of groups as well
        const filteredChildren = filterNavItemsByPermission(
          item.children,
          hasPermission,
          hasFullAccess
        );
        if (filteredChildren.length === 0) {
          // If no children are visible, don't show the group
          return null;
        }
        return {
          ...item,
          children: filteredChildren,
        };
      }
      return item;
    })
    .filter((item): item is NavItem => item !== null);
};

/* -------------------- Pure helpers (no state, no effects) -------------------- */
const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const itemIsActive = (pathname: string, item: NavItem): boolean => {
  if (isGroup(item)) {
    if (item.baseHref && isActiveHref(pathname, item.baseHref)) return true;
    return item.children.some((child) => itemIsActive(pathname, child));
  }
  return isActiveHref(pathname, item.href);
};

// Collect keys of groups that should be auto-open based on current path
const computeActiveOpenKeys = (
  items: NavItem[],
  pathname: string
): Set<string> => {
  const open = new Set<string>();

  const walk = (node: NavItem): boolean => {
    if (!isGroup(node)) {
      return isActiveHref(pathname, node.href);
    }

    const baseMatch = node.baseHref
      ? isActiveHref(pathname, node.baseHref)
      : false;
    const childActive = node.children.map(walk).some(Boolean);

    if (baseMatch || childActive) {
      open.add(node.key);
      return true;
    }
    return false;
  };

  items.forEach(walk);
  return open;
};

/* -------------------- Component -------------------- */
export default function TenantSidebar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  // NEW: pin state: when true, sidebar is always expanded
  const [pinned, setPinned] = useState(false);

  // Branch details state
  const [branchName, setBranchName] = useState<string>("Company Name");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);

  // Organizations state for switcher - always fetch for employees
  const { organizations, loading: loadingOrgs } = useOrganizations(true);
  const [orgLogoUrls, setOrgLogoUrls] = useState<{
    [branchId: string]: string | null;
  }>({});
  const [switchingOrg, setSwitchingOrg] = useState(false);

  // keys explicitly toggled OPEN by user
  const [toggledOpenKeys, setToggledOpenKeys] = useState<Set<string>>(
    new Set()
  );

  // keys explicitly CLOSED by user (overrides activeOpenKeys)
  const [explicitlyClosedKeys, setExplicitlyClosedKeys] = useState<Set<string>>(
    new Set()
  );

  // Get permissions hook
  const {
    hasPermission,
    hasFullAccess,
    isLoading: isLoadingPermissions,
    setPermissions,
  } = usePermissions();

  // Filter navigation items based on permissions
  const filteredNavConfig = useMemo(() => {
    // If user has full access (tenant-owner/admin), show all items immediately
    if (hasFullAccess) {
      return navConfig;
    }

    // If permissions are loading for employees, show empty sidebar (will be filtered once loaded)
    // This prevents showing all items before permissions are checked
    if (isLoadingPermissions) {
      return [];
    }

    // Debug logging for job-titles permission
    if (process.env.NODE_ENV === "development") {
      const jobTitlesPermission = hasPermission("job-titles", "read");
      console.log("[Sidebar] Job Titles Permission Check:", {
        hasPermission: jobTitlesPermission,
        section: "job-titles",
        action: "read",
        hasFullAccess,
        isLoadingPermissions,
      });
    }

    // For employees, filter based on permissions
    // Only show items where user has "read" permission
    return filterNavItemsByPermission(navConfig, hasPermission, hasFullAccess);
  }, [hasPermission, hasFullAccess, isLoadingPermissions]);

  // groups that should be open because current route lives under them
  const activeOpenKeys = useMemo(
    () => computeActiveOpenKeys(filteredNavConfig, pathname),
    [filteredNavConfig, pathname]
  );

  // effective open keys = union of active + toggled, but exclude explicitly closed
  const openKeys = useMemo(() => {
    const s = new Set<string>();
    // Add active keys (if not explicitly closed)
    activeOpenKeys.forEach((k) => {
      if (!explicitlyClosedKeys.has(k)) {
        s.add(k);
      }
    });
    // Add user-toggled keys (if not explicitly closed)
    toggledOpenKeys.forEach((k) => {
      if (!explicitlyClosedKeys.has(k)) {
        s.add(k);
      }
    });
    return s;
  }, [activeOpenKeys, toggledOpenKeys, explicitlyClosedKeys]);

  const toggleKey = (key: string) => {
    const currentlyOpen = openKeys.has(key);

    if (currentlyOpen) {
      // User is closing it - mark as explicitly closed
      setExplicitlyClosedKeys((prev) => new Set(prev).add(key));
      // Also remove from toggledOpen if it was there
      setToggledOpenKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      // User is opening it - remove from explicitly closed, add to toggled
      setExplicitlyClosedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setToggledOpenKeys((prev) => new Set(prev).add(key));
    }
  };

  const handleLogout = () => dispatch(logoutUser());

  // Fetch branch details for name and logo
  useEffect(() => {
    if (!user) return;

    // Type guard for user with activeAssignment
    const userWithAssignment = user as {
      activeAssignment?: { branchId?: string | number };
    };

    const branchId = userWithAssignment?.activeAssignment?.branchId
      ? String(userWithAssignment.activeAssignment.branchId)
      : null;

    if (!branchId) return;

    const fetchBranchDetails = async () => {
      try {
        const res = await axiosInstance.get(`/branches/${branchId}/details`);
        const data = res.data.data;

        // Set branch name
        if (data.name) {
          setBranchName(data.name);
        }

        // Handle logo - could be URL string, fileId string, or { fileId, key } object
        if (data.logo) {
          if (typeof data.logo === "string") {
            // Check if it's a fileId (ObjectId format) or a URL
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(data.logo);
            if (isObjectId) {
              // It's a fileId stored as string
              setLogoFileId(data.logo);
            } else {
              // It's a regular URL string
              setLogoUrl(data.logo);
              setLogoFileId(null);
            }
          } else if (data.logo?.fileId) {
            // If it's an object with fileId
            const fileId = String(data.logo.fileId);
            setLogoFileId(fileId);
          }
        } else {
          setLogoFileId(null);
          setLogoUrl(null);
        }
      } catch (error) {
        console.error("Failed to fetch branch details", error);
      }
    };

    void fetchBranchDetails();
  }, [user]);

  // Fetch signed URL for logo when fileId changes
  useEffect(() => {
    if (!logoFileId) {
      setLogoUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        const urlRes = await axiosInstance.get<{
          url: string;
          expiresIn: number;
        }>(`/uploads/${logoFileId}/url`);
        setLogoUrl(urlRes.data?.url || null);
      } catch (error) {
        console.error("Failed to fetch logo signed URL", error);
        setLogoUrl(null);
      }
    };

    void fetchSignedUrl();
  }, [logoFileId]);

  // Check if user is an employee (not tenant-owner or admin)
  const isEmployee = useMemo(() => {
    if (!user) return false;
    const role = (user as any)?.activeAssignment?.role || (user as any)?.role;
    return role === "employee";
  }, [user]);

  // Fetch organization logos
  useEffect(() => {
    if (!isEmployee || organizations.length === 0) return;

    const fetchOrgLogos = async () => {
      const logoUrlMap: { [branchId: string]: string | null } = {};

      for (const org of organizations) {
        if (!org.branchId?._id) continue;

        const branchId = org.branchId._id;
        const logo = org.branchId.logo;

        if (!logo) {
          logoUrlMap[branchId] = null;
          continue;
        }

        // If logo is already a URL string
        if (typeof logo === "string" && !/^[0-9a-fA-F]{24}$/.test(logo)) {
          logoUrlMap[branchId] = logo;
          continue;
        }

        // If logo is a fileId (ObjectId string) or object with fileId
        const fileId =
          typeof logo === "string"
            ? logo
            : logo?.fileId
              ? String(logo.fileId)
              : null;

        if (fileId) {
          try {
            const urlRes = await axiosInstance.get<{
              url: string;
              expiresIn: number;
            }>(`/uploads/${fileId}/url`);
            logoUrlMap[branchId] = urlRes.data?.url || null;
          } catch (error) {
            console.error(`Failed to fetch logo for branch ${branchId}`, error);
            logoUrlMap[branchId] = null;
          }
        } else {
          logoUrlMap[branchId] = null;
        }
      }

      setOrgLogoUrls(logoUrlMap);
    };

    void fetchOrgLogos();
  }, [organizations, isEmployee]);

  // Handle organization switching
  const handleSwitchOrganization = useCallback(
    async (branchId: string) => {
      if (!branchId || switchingOrg) return;

      setSwitchingOrg(true);
      try {
        const res = await axiosInstance.post(
          "/auth/switch-organization-context",
          {
            branchId,
          }
        );

        // Store permissions in the hook
        if (res.data.data && setPermissions) {
          setPermissions({
            aggregatedRoles: res.data.data.aggregatedRoles,
            permissions: res.data.data.permissions,
          });
        }

        // Refresh user profile to get updated activeAssignment
        await dispatch(getProfile());

        // Show success message
        toast.success("Switched organization successfully");

        // Reload the page to refresh all data
        router.refresh();
      } catch (error: any) {
        console.error("Failed to switch organization context", error);
        const errorMessage =
          error.response?.data?.message ||
          "Failed to switch organization. Please try again.";
        toast.error(errorMessage);
      } finally {
        setSwitchingOrg(false);
      }
    },
    [dispatch, router, switchingOrg, setPermissions]
  );

  // Get current branch ID
  const currentBranchId = useMemo(() => {
    if (!user) return null;
    const userWithAssignment = user as {
      activeAssignment?: { branchId?: string | number };
    };
    return userWithAssignment?.activeAssignment?.branchId
      ? String(userWithAssignment.activeAssignment.branchId)
      : null;
  }, [user]);

  // Prepare organization options for dropdown
  const organizationOptions = useMemo(() => {
    // First check if user is an employee
    if (!isEmployee) {
      return [];
    }

    // Filter organizations that have valid branchIds
    const validOrgs = organizations.filter((org) => {
      const hasBranchId = !!org.branchId?._id;
      if (!hasBranchId) {
        console.warn("[Sidebar] Organization missing branchId:", org);
      }
      return hasBranchId;
    });

    // Need at least 2 organizations to show switcher
    if (validOrgs.length <= 1) {
      return [];
    }

    // Map to options format
    const options = validOrgs.map((org) => {
      const branchId = String(org.branchId!._id);
      const orgName = org.branchId?.name || "Unknown Organization";
      const orgLogo = orgLogoUrls[branchId] || null;

      return {
        value: branchId,
        label: orgName,
        logo: orgLogo,
      };
    });

    return options;
  }, [organizations, orgLogoUrls, isEmployee]);

  // Show dropdown only if employee has multiple organizations
  const showOrgSwitcher = isEmployee && organizationOptions.length > 1;

  // Debug logging (always log in dev to help diagnose)
  useEffect(() => {
    console.log("[Sidebar] Organization Switcher State", {
      showOrgSwitcher,
      isEmployee,
      userRole: (user as any)?.activeAssignment?.role || (user as any)?.role,
      organizationsCount: organizations.length,
      validOrganizationsCount: organizations.filter((org) => org.branchId?._id)
        .length,
      organizationOptionsCount: organizationOptions.length,
      loadingOrgs,
      currentBranchId,
      organizations: organizations.map((org) => ({
        _id: org._id,
        branchId: org.branchId?._id,
        branchName: org.branchId?.name,
        hasBranchId: !!org.branchId?._id,
      })),
      organizationOptions,
    });
  }, [
    showOrgSwitcher,
    isEmployee,
    organizations,
    organizationOptions,
    loadingOrgs,
    currentBranchId,
    user,
  ]);

  // Helpers to produce classes that either respond to hover (default)
  // or are always "expanded" when pinned.
  const expandedJustifyCls = pinned
    ? "justify-start"
    : "justify-center group-hover:justify-start";

  // Use specific Tailwind classes with max-w utilities that exist in Tailwind
  const showTextCls = pinned
    ? "max-w-[200px] opacity-100 translate-x-0"
    : "max-w-0 overflow-hidden opacity-0 translate-x-2 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:translate-x-0";

  const showTextClsNarrow = pinned
    ? "max-w-[180px] opacity-100 translate-x-0"
    : "max-w-0 overflow-hidden opacity-0 translate-x-2 group-hover:max-w-[180px] group-hover:opacity-100 group-hover:translate-x-0";

  const showTextClsChildren = pinned
    ? "max-w-[160px] opacity-100 translate-x-0"
    : "w-0 overflow-hidden opacity-0 translate-x-2 group-hover:w-auto group-hover:max-w-[160px] group-hover:opacity-100 group-hover:translate-x-0";

  const showEndIconCls = pinned
    ? "opacity-100 translate-x-0 w-auto"
    : "w-0 overflow-hidden opacity-0 translate-x-2 group-hover:w-auto group-hover:opacity-100 group-hover:translate-x-0";

  const showChildrenContainerBase = pinned
    ? "block"
    : "hidden group-hover:block";

  // Conditional classes for label and chevron positioning
  const labelPositionCls = pinned
    ? "" // Normal flow when pinned
    : "absolute pointer-events-none"; // Absolutely positioned when collapsed

  const chevronPositionCls = pinned
    ? "" // Normal flow when pinned
    : "absolute pointer-events-none"; // Absolutely positioned when collapsed

  return (
    <aside
      className={cn(
        "group h-screen relative z-40",
        pinned ? "w-64" : "w-16 hover:w-64", // width behavior
        "transition-[width] duration-300 ease-out",
        "bg-primary text-white flex flex-col justify-between",
        "rounded-tr-3xl rounded-br-3xl shadow-lg overflow-hidden"
      )}
    >
      {/* Top */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 px-3 py-6 border-b border-white/10 flex-shrink-0 relative z-50">
          {/* Logo or placeholder */}
          {logoUrl ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden bg-white/15 shrink-0">
              <Image
                src={logoUrl}
                alt={branchName}
                width={32}
                height={32}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-sm font-bold shrink-0">
              {branchName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Organization Switcher Dropdown (only for employees with multiple orgs) */}
          {showOrgSwitcher ? (
            <div className="flex-1 min-w-0">
              <OrganizationSwitcher
                organizations={organizationOptions}
                currentBranchId={currentBranchId}
                onSwitch={handleSwitchOrganization}
                switching={switchingOrg || loadingOrgs}
                pinned={pinned}
              />
            </div>
          ) : (
            /* Company name (shows when expanded) - fallback when no switcher */
            <span
              className={cn(
                showTextCls,
                "transition-all duration-300 ease-out",
                "text-lg font-semibold tracking-wide whitespace-nowrap"
              )}
            >
              {branchName}
            </span>
          )}

          {/* Pin toggle */}
          <button
            onClick={() => setPinned((p) => !p)}
            className={cn(
              // visibility: if pinned => always visible; else only on hover/open
              pinned ? "inline-flex" : "hidden group-hover:inline-flex",

              // position & look
              "ml-auto rounded-lg p-1.5 hover:bg-white/10 transition-colors",

              // subtle fade-in when appearing on hover (no need when pinned)
              pinned
                ? ""
                : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",

              // slight background when pinned to hint it's active
              pinned ? "bg-white/15" : ""
            )}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={pinned}
          >
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>

        <nav className="mt-4 px-2 space-y-1 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
          {filteredNavConfig.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              depth={0}
              openKeys={openKeys}
              onToggle={toggleKey}
              pathname={pathname}
              pinned={pinned}
              expandedJustifyCls={expandedJustifyCls}
              showTextCls={showTextCls}
              showTextClsNarrow={showTextClsNarrow}
              showTextClsChildren={showTextClsChildren}
              showEndIconCls={showEndIconCls}
              showChildrenContainerBase={showChildrenContainerBase}
              labelPositionCls={labelPositionCls}
              chevronPositionCls={chevronPositionCls}
            />
          ))}
        </nav>
      </div>

      {/* Bottom user section */}
      <div className="bg-white/10 px-3 py-3 flex items-center gap-3 text-white flex-shrink-0">
        <button
          aria-label="Logout"
          className={cn(
            pinned ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2",
            "group-hover:opacity-100 group-hover:translate-x-0",
            "transition-all duration-300 ease-out",
            "ml-auto"
          )}
          onClick={handleLogout}
        >
          <LogOut size={16} className="opacity-70 hover:opacity-100" />
        </button>
      </div>
    </aside>
  );
}

/* -------------------- Organization Switcher Component -------------------- */
function OrganizationSwitcher({
  organizations,
  currentBranchId,
  onSwitch,
  switching,
  pinned,
}: {
  organizations: Array<{ value: string; label: string; logo: string | null }>;
  currentBranchId: string | null;
  onSwitch: (branchId: string) => void;
  switching: boolean;
  pinned: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentOrg = organizations.find((opt) => opt.value === currentBranchId);

  // Debug logging
  useEffect(() => {
    console.log("[OrganizationSwitcher] Component State", {
      organizationsCount: organizations.length,
      currentBranchId,
      currentOrg,
      switching,
      isOpen,
      pinned,
    });
  }, [organizations, currentBranchId, currentOrg, switching, isOpen, pinned]);

  if (organizations.length === 0) {
    console.warn("[OrganizationSwitcher] No organizations provided");
    return null;
  }

  // Show/hide based on pinned state (similar to other sidebar elements)
  const visibilityCls = pinned
    ? "opacity-100 translate-x-0"
    : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0";

  return (
    <div
      className={cn(
        "flex-1 min-w-0 relative transition-all duration-300 ease-out z-50",
        visibilityCls
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg",
          "bg-white/10 hover:bg-white/20 border border-white/20",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "text-left min-w-0 relative z-50"
        )}
        title={currentOrg?.label || "Select organization"}
      >
        {currentOrg?.logo ? (
          <Image
            src={currentOrg.logo}
            alt={currentOrg.label}
            width={20}
            height={20}
            className="w-5 h-5 rounded object-cover shrink-0"
            unoptimized
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-xs font-semibold shrink-0">
            {currentOrg?.label?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <span className="truncate text-white font-semibold text-sm flex-1 min-w-0">
          {currentOrg?.label || "Select organization"}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 transition-transform duration-200 text-white",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-[101] max-h-64 overflow-y-auto scrollbar-hide">
            {organizations.map((org) => (
              <button
                key={org.value}
                onClick={() => {
                  if (org.value !== currentBranchId) {
                    onSwitch(org.value);
                  }
                  setIsOpen(false);
                }}
                disabled={switching || org.value === currentBranchId}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-left",
                  "hover:bg-gray-50 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  org.value === currentBranchId && "bg-blue-50"
                )}
              >
                <span className="truncate text-gray-900 font-medium text-sm flex-1">
                  {org.label}
                </span>
                {org.value === currentBranchId && (
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- Recursive Item -------------------- */
function SidebarItem({
  item,
  depth,
  openKeys,
  onToggle,
  pathname,
  pinned,
  expandedJustifyCls,
  showTextCls,
  showTextClsNarrow,
  showTextClsChildren,
  showEndIconCls,
  showChildrenContainerBase,
  labelPositionCls,
  chevronPositionCls,
}: {
  item: NavItem;
  depth: number;
  openKeys: Set<string>;
  onToggle: (key: string) => void;
  pathname: string;
  pinned: boolean;
  expandedJustifyCls: string;
  showTextCls: string;
  showTextClsNarrow: string;
  showTextClsChildren: string;
  showEndIconCls: string;
  showChildrenContainerBase: string;
  labelPositionCls: string;
  chevronPositionCls: string;
}) {
  const paddingLeft = Math.min(8 + depth * 14, 40); // indent nested levels slightly

  if (!isGroup(item)) {
    const Icon = item.icon;
    const active = isActiveHref(pathname, item.href);

    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-colors",
          expandedJustifyCls,
          active ? "bg-white text-primary font-semibold" : "hover:bg-white/10"
        )}
        style={{ paddingLeft }}
      >
        {Icon ? (
          <Icon size={20} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
        <span
          className={cn(
            showTextClsNarrow,
            "transition-all duration-300 ease-out",
            "whitespace-nowrap"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  }

  // Group
  const Icon = item.icon;
  const open = openKeys.has(item.key);
  const activeGroup = itemIsActive(pathname, item);

  return (
    <div>
      <button
        onClick={() => onToggle(item.key)}
        className={cn(
          "relative w-full flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors",
          pinned
            ? "justify-between gap-3"
            : "justify-center group-hover:justify-start group-hover:gap-3",
          activeGroup
            ? "bg-white text-primary font-semibold"
            : "hover:bg-white/10"
        )}
        aria-expanded={open}
        style={{ paddingLeft }}
      >
        {Icon ? (
          <Icon size={20} className="shrink-0" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
        )}
        <span
          className={cn(
            showTextClsChildren,
            "transition-all duration-300 ease-out",
            "whitespace-nowrap flex-1"
          )}
        >
          {item.label}
        </span>
        <span
          className={cn(
            showEndIconCls,
            "transition-all duration-300 ease-out shrink-0"
          )}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {/* Children: hidden when sidebar is collapsed; visible when pinned; animated when expanded/open */}
      <div
        className={cn(
          showChildrenContainerBase,
          "transition-[max-height,opacity,margin] duration-300 ease-out",
          open ? "opacity-100 mt-1" : "opacity-0 mt-0",
          open
            ? "overflow-y-auto overflow-x-hidden scrollbar-hide"
            : "overflow-hidden",
          "ml-8 space-y-1"
        )}
        style={{
          maxHeight: open ? "calc(100vh - 300px)" : 0,
          maxWidth: "100%",
        }}
      >
        {item.children.map((child) => (
          <SidebarItem
            key={child.key}
            item={child}
            depth={depth + 1}
            openKeys={openKeys}
            onToggle={onToggle}
            pathname={pathname}
            pinned={pinned}
            expandedJustifyCls={expandedJustifyCls}
            showTextCls={showTextCls}
            showTextClsNarrow={showTextClsNarrow}
            showTextClsChildren={showTextClsChildren}
            showEndIconCls={showEndIconCls}
            showChildrenContainerBase={showChildrenContainerBase}
            labelPositionCls={labelPositionCls}
            chevronPositionCls={chevronPositionCls}
          />
        ))}
      </div>
    </div>
  );
}
