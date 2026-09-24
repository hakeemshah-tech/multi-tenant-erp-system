"use client";

import React, { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "rizzui";
import { Dialog, Transition } from "@headlessui/react";
import {
  ChevronRight,
  User,
  Home,
  Briefcase,
  DollarSign,
  FileText,
  Settings,
  ClipboardList,
  Plus,
  X,
  Check,
  Eye,
  Edit,
  Trash2,
  Download,
  RotateCcw,
  Save,
  Loader2,
  Info,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

// Types
interface MenuItem {
  id: string;
  name: string;
  icon?: string;
  items?: string[];
  children?: MenuItem[];
  sensitive?: boolean;
}

interface Role {
  id: string;
  name: string;
  color: string;
  desc: string;
  level?: number;
}

interface Permissions {
  [sectionKey: string]: {
    [roleId: string]: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
  };
}

// Parent section from organization config
interface ParentSection {
  sectionKey: string;
  sectionLabel: string;
}

// Parent sections will be loaded from organization config
// Menu structure is built dynamically in getMenuStructure() function

// Role Level interface
interface RoleLevel {
  _id: string;
  level: number;
  name: string;
  description?: string;
}

// Default roles
const defaultRoles: Role[] = [
  {
    id: "system_admin",
    name: "System Admin",
    color: "purple",
    desc: "Full system access",
  },
  {
    id: "hr_manager",
    name: "HR Manager",
    color: "blue",
    desc: "HR department oversight",
  },
  {
    id: "hr_officer",
    name: "HR Officer",
    color: "blue",
    desc: "HR operations",
  },
  {
    id: "payroll_manager",
    name: "Payroll Manager",
    color: "green",
    desc: "Payroll oversight",
  },
  {
    id: "payroll_officer",
    name: "Payroll Officer",
    color: "green",
    desc: "Payroll operations",
  },
  {
    id: "support_worker",
    name: "Support Worker",
    color: "amber",
    desc: "Field staff",
  },
  {
    id: "standard_employee",
    name: "Standard Employee",
    color: "gray",
    desc: "Self-service only",
  },
];

// Default permissions (no longer used - permissions loaded from backend)
const defaultPermissions: Permissions = {
  "basic-information": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "contact-information": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "cultural-information": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: false, write: false, delete: false },
    payroll_officer: { read: false, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "visa-residency": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: false, delete: false },
  },
  "emergency-contact": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: true, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "residential-address": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "other-address": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "employment-details": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: false, delete: false },
  },
  "tax-information": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: false, write: false, delete: false },
    hr_officer: { read: false, write: false, delete: false },
    payroll_manager: { read: true, write: true, delete: true },
    payroll_officer: { read: true, write: true, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "bank-account-details": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: false, write: false, delete: false },
    hr_officer: { read: false, write: false, delete: false },
    payroll_manager: { read: true, write: true, delete: true },
    payroll_officer: { read: true, write: true, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "payroll-details-entry": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: false, delete: false },
    hr_officer: { read: true, write: false, delete: false },
    payroll_manager: { read: true, write: true, delete: true },
    payroll_officer: { read: true, write: true, delete: false },
    support_worker: { read: true, write: false, delete: false },
    standard_employee: { read: true, write: false, delete: false },
  },
  "employee-documents": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: true },
    payroll_manager: { read: true, write: true, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: true, write: true, delete: false },
    standard_employee: { read: true, write: true, delete: false },
  },
  "audit-trail": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: false, delete: false },
    hr_officer: { read: true, write: false, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  departments: {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  "job-titles": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  fields: {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: false },
    hr_officer: { read: true, write: false, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  "config-documents": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  contracts: {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: true, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  "industry-awards": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: true },
    hr_officer: { read: true, write: false, delete: false },
    payroll_manager: { read: true, write: true, delete: true },
    payroll_officer: { read: true, write: true, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  "organisation-details": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: true, delete: false },
    hr_officer: { read: true, write: false, delete: false },
    payroll_manager: { read: true, write: false, delete: false },
    payroll_officer: { read: true, write: false, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
  "payroll-settings": {
    system_admin: { read: true, write: true, delete: true },
    hr_manager: { read: true, write: false, delete: false },
    hr_officer: { read: false, write: false, delete: false },
    payroll_manager: { read: true, write: true, delete: true },
    payroll_officer: { read: true, write: true, delete: false },
    support_worker: { read: false, write: false, delete: false },
    standard_employee: { read: false, write: false, delete: false },
  },
};

// Helper function to get all section IDs
function getAllSectionIds(menu: MenuItem[]): string[] {
  let ids: string[] = [];
  menu.forEach((item) => {
    if (item.items) ids.push(...item.items);
    if (item.children) ids.push(...getAllSectionIds(item.children));
  });
  return ids;
}

// Helper function to get breadcrumb
function getBreadcrumb(
  id: string,
  menu: MenuItem[],
  path: string[] = []
): string | null {
  for (const item of menu) {
    if (item.id === id || (item.items && item.items.includes(id))) {
      return [...path, item.name].join(" > ");
    }
    if (item.children) {
      const result = getBreadcrumb(id, item.children, [...path, item.name]);
      if (result) return result;
    }
  }
  return null;
}

// Permission types
const permissionTypes = [
  {
    id: "read",
    name: "Read",
    icon: Eye,
    color: "blue",
    desc: "View data",
  },
  {
    id: "write",
    name: "Write",
    icon: Edit,
    color: "amber",
    desc: "Create & edit data",
  },
  {
    id: "delete",
    name: "Unactive/Active",
    icon: Trash2,
    color: "red",
    desc: "Unactive/Active Data",
  },
];

// Color options for roles
const roleColors = [
  "purple",
  "blue",
  "green",
  "amber",
  "red",
  "pink",
  "teal",
  "gray",
];

// Color mapping for Tailwind classes
const colorClasses = {
  purple: {
    bg100: "bg-purple-100",
    bg500: "bg-purple-500",
    text600: "text-purple-600",
  },
  blue: {
    bg100: "bg-blue-100",
    bg500: "bg-blue-500",
    text600: "text-blue-600",
  },
  green: {
    bg100: "bg-green-100",
    bg500: "bg-green-500",
    text600: "text-green-600",
  },
  amber: {
    bg100: "bg-amber-100",
    bg500: "bg-amber-500",
    text600: "text-amber-600",
  },
  red: {
    bg100: "bg-red-100",
    bg500: "bg-red-500",
    text600: "text-red-600",
  },
  pink: {
    bg100: "bg-pink-100",
    bg500: "bg-pink-500",
    text600: "text-pink-600",
  },
  teal: {
    bg100: "bg-teal-100",
    bg500: "bg-teal-500",
    text600: "text-teal-600",
  },
  gray: {
    bg100: "bg-gray-100",
    bg500: "bg-gray-500",
    text600: "text-gray-600",
  },
};

export default function RBACManagementPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("rbac", "read");
  const canWrite = hasPermission("rbac", "write");
  const canDelete = hasPermission("rbac", "delete");
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [permissions, setPermissions] = useState<Permissions>(
    JSON.parse(JSON.stringify(defaultPermissions))
  );
  // Data access levels per role per section (single level per role)
  const [dataAccessLevels, setDataAccessLevels] = useState<{
    [sectionKey: string]: {
      [roleId: string]: number;
    };
  }>({});
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string>("Never");
  const [showEmployeeLevelsModal, setShowEmployeeLevelsModal] = useState(false);

  // Modals
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showManageRolesModal, setShowManageRolesModal] = useState(false);
  const [selectedRoleColor, setSelectedRoleColor] = useState("blue");

  // Add role form
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleLevel, setNewRoleLevel] = useState<number>(1);

  // Edit role form
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDesc, setEditRoleDesc] = useState("");
  const [editRoleLevel, setEditRoleLevel] = useState<number>(1);
  const [editRoleColor, setEditRoleColor] = useState("blue");

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [roleLevels, setRoleLevels] = useState<RoleLevel[]>([]);
  const [isLoadingRoleLevels, setIsLoadingRoleLevels] = useState(true);
  const [parentSections, setParentSections] = useState<ParentSection[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);

  // Load role levels from API
  useEffect(() => {
    const loadRoleLevels = async () => {
      try {
        setIsLoadingRoleLevels(true);
        const response = await axiosInstance.get("/role-levels");
        setRoleLevels(response.data.data || []);
      } catch (error: any) {
        console.error("Error loading role levels:", error);
        toast.error(
          error.response?.data?.message || "Failed to load role levels"
        );
      } finally {
        setIsLoadingRoleLevels(false);
      }
    };
    loadRoleLevels();
  }, []);

  // Load parent sections from organization config
  useEffect(() => {
    const loadParentSections = async () => {
      try {
        setIsLoadingSections(true);
        const response = await axiosInstance.get("/employee-field-config");
        const config = response.data.data;

        if (config && config.sections && Array.isArray(config.sections)) {
          // Extract only parent sections (no inner sections)
          const sections: ParentSection[] = config.sections.map(
            (section: any) => ({
              sectionKey: section.sectionKey,
              sectionLabel: section.sectionLabel,
            })
          );

          setParentSections(sections);
        }
      } catch (error: any) {
        console.error("Error loading parent sections:", error);
        toast.error(error.response?.data?.message || "Failed to load sections");
      } finally {
        setIsLoadingSections(false);
      }
    };
    loadParentSections();
  }, []);

  // Load permissions from backend API
  useEffect(() => {
    const loadPermissions = async () => {
      if (roles.length === 0 || parentSections.length === 0) return; // Wait for roles and sections to load

      try {
        const response = await axiosInstance.get("/role-permissions");
        const responseData = response.data.data || {};
        const allPermissions = responseData.permissions || {};

        // Transform backend format to frontend format
        const transformedPermissions: Permissions = {};

        // Get all section keys from menu structure (including non-parent sections)
        const getAllSectionKeys = (menuItems: MenuItem[]): string[] => {
          const keys: string[] = [];
          menuItems.forEach((item) => {
            if (item.items && item.items.length > 0) {
              keys.push(...item.items);
            }
            if (item.children) {
              keys.push(...getAllSectionKeys(item.children));
            }
          });
          return keys;
        };

        const allSectionKeys = getAllSectionKeys(getMenuStructure());

        // Initialize all sections with all roles
        const transformedDataAccessLevels: {
          [sectionKey: string]: {
            [roleId: string]: number;
          };
        } = {};
        allSectionKeys.forEach((sectionKey) => {
          transformedPermissions[sectionKey] = {};
          transformedDataAccessLevels[sectionKey] = {};
          roles.forEach((role) => {
            // Initialize data access levels per role (use role's level as default)
            transformedDataAccessLevels[sectionKey][role.id] = role.level || 1;
            // System Admin always has full access to all sections
            if (role.id === "system_admin") {
              transformedPermissions[sectionKey][role.id] = {
                read: true,
                write: true,
                delete: true,
              };
              transformedDataAccessLevels[sectionKey][role.id] = 7;
            } else {
              const sectionPerm = allPermissions[role.id]?.[sectionKey];
              transformedPermissions[sectionKey][role.id] = sectionPerm || {
                read: false,
                write: false,
                delete: false,
              };
              // Load data access level from API if available (for Employees sections)
              if (
                isEmployeesSection(sectionKey) &&
                sectionPerm &&
                (sectionPerm as any).dataAccessLevel !== undefined
              ) {
                transformedDataAccessLevels[sectionKey][role.id] = (
                  sectionPerm as any
                ).dataAccessLevel;
              }
            }
          });
        });

        setPermissions(transformedPermissions);

        // Load data access levels from role permissions for Employees sections
        // Note: Currently using role's level as default, can be extended to load from role permissions API if needed
        // For now, data access levels are initialized with each role's level

        setDataAccessLevels(transformedDataAccessLevels);
      } catch (error: any) {
        console.error("Error loading permissions:", error);
        // Don't show error toast on initial load, just log it
      }
    };

    loadPermissions();
  }, [roles, parentSections]);

  // Load roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoadingRoles(true);
      try {
        const response = await axiosInstance.get("/roles");
        const fetchedRoles = response.data.data || [];

        // Transform API response to match our Role interface
        const transformedRoles: Role[] = fetchedRoles.map((role: any) => ({
          id: role.roleId,
          name: role.name,
          color: role.color,
          desc: role.description || "",
          level: role.level || 1,
        }));

        // Merge with default roles (system_admin should always be present)
        const systemAdminRole = defaultRoles.find(
          (r) => r.id === "system_admin"
        );
        const hasSystemAdmin = transformedRoles.find(
          (r) => r.id === "system_admin"
        );

        if (systemAdminRole && !hasSystemAdmin) {
          transformedRoles.unshift(systemAdminRole);
        }

        setRoles(transformedRoles);
      } catch (error: any) {
        console.error("Failed to fetch roles", error);
        // Fallback to default roles if API fails
        setRoles(defaultRoles);
      } finally {
        setIsLoadingRoles(false);
      }
    };

    fetchRoles();
  }, []);

  // Toggle menu expansion
  const toggleMenuExpand = (id: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select section
  const selectSection = (id: string, name: string) => {
    setSelectedMenuItem(id);
    setCurrentSection(id);

    // Ensure section exists in permissions
    setPermissions((prev) => {
      const next = { ...prev };
      if (!next[id]) {
        next[id] = {};
      }
      roles.forEach((role) => {
        if (!next[id][role.id]) {
          // System Admin always has full access
          if (role.id === "system_admin") {
            next[id][role.id] = {
              read: true,
              write: true,
              delete: true,
            };
          } else {
            next[id][role.id] = { read: false, write: false, delete: false };
          }
        }
      });
      return next;
    });

    // Initialize data access levels for Employees sections per role
    if (isEmployeesSection(id)) {
      setDataAccessLevels((prev) => {
        const next = { ...prev };
        if (!next[id]) {
          next[id] = {};
        }
        roles.forEach((role) => {
          if (next[id][role.id] === undefined) {
            next[id][role.id] = role.level || 1;
          }
        });
        return next;
      });
    }
  };

  // Toggle permission
  const togglePermission = (
    sectionId: string,
    roleId: string,
    permType: "read" | "write" | "delete"
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [roleId]: {
          ...prev[sectionId][roleId],
          [permType]: !prev[sectionId][roleId][permType],
        },
      },
    }));
  };

  // Set all permissions for a role in a section
  const setAllPermissions = (
    sectionId: string,
    roleId: string,
    value: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [roleId]: {
          read: value,
          write: value,
          delete: value,
        },
      },
    }));
  };

  // Reset current section
  const resetCurrentSection = () => {
    if (!currentSection) return;
    if (!confirm(`Reset permissions for this section to defaults?`)) {
      return;
    }

    if (defaultPermissions[currentSection]) {
      setPermissions((prev) => ({
        ...prev,
        [currentSection]: JSON.parse(
          JSON.stringify(defaultPermissions[currentSection])
        ),
      }));

      // Ensure all roles exist
      setPermissions((prev) => {
        const next = { ...prev };
        roles.forEach((role) => {
          if (!next[currentSection!][role.id]) {
            next[currentSection!][role.id] = {
              read: false,
              write: false,
              delete: false,
            };
          }
        });
        return next;
      });
    }
  };

  // Add new role
  const addNewRole = async () => {
    const name = newRoleName.trim();
    const desc = newRoleDesc.trim();

    if (!name) {
      toast.error("Please enter a role name");
      return;
    }

    // Auto-generate roleId from name (lowercase, replace spaces with underscores, remove special chars)
    const id = name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    // Check if role already exists locally
    if (roles.find((r) => r.id === id)) {
      toast.error("A role with this name already exists");
      return;
    }

    try {
      // Call API to create role
      const response = await axiosInstance.post("/roles", {
        roleId: id,
        name,
        description: desc,
        color: selectedRoleColor,
        level: newRoleLevel,
      });

      const createdRole = response.data.data;

      // Transform API response to match our Role interface
      const newRole: Role = {
        id: createdRole.roleId,
        name: createdRole.name,
        color: createdRole.color,
        desc: createdRole.description || "",
        level: createdRole.level || 1,
      };

      setRoles((prev) => [...prev, newRole]);

      // Add this role to all existing sections with no permissions
      setPermissions((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sectionId) => {
          next[sectionId][id] = { read: false, write: false, delete: false };
        });
        return next;
      });

      setShowAddRoleModal(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setNewRoleLevel(1);
      setSelectedRoleColor("blue");

      saveAllChanges();
      toast.success("Role added successfully");
    } catch (error: any) {
      console.error("Failed to create role", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create role";
      toast.error(errorMessage);
    }
  };

  // Delete role
  const deleteRole = async (roleId: string) => {
    if (roleId === "system_admin") {
      toast.error("Cannot delete System Admin role");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete this role? This will remove all its permissions.`
      )
    ) {
      return;
    }

    try {
      // Call API to delete role
      await axiosInstance.delete(`/roles/${roleId}`);

      setRoles((prev) => prev.filter((r) => r.id !== roleId));

      // Remove role from all sections
      setPermissions((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sectionId) => {
          delete next[sectionId][roleId];
        });
        return next;
      });

      saveAllChanges();
      toast.success("Role deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete role", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete role";
      toast.error(errorMessage);
    }
  };

  // Open edit role modal
  const openEditRoleModal = (role: Role) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDesc(role.desc || "");
    setEditRoleLevel(role.level || 1);
    setEditRoleColor(role.color);
    setShowEditRoleModal(true);
  };

  // Edit role
  const editRole = async () => {
    if (!editingRole) return;

    const name = editRoleName.trim();
    const desc = editRoleDesc.trim();

    if (!name) {
      toast.error("Please enter a role name");
      return;
    }

    try {
      // Call API to update role
      await axiosInstance.put(`/roles/${editingRole.id}`, {
        name,
        description: desc,
        color: editRoleColor,
        level: editRoleLevel,
      });

      // Update local state
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? { ...r, name, desc, color: editRoleColor, level: editRoleLevel }
            : r
        )
      );

      setShowEditRoleModal(false);
      setEditingRole(null);
      toast.success("Role updated successfully");
    } catch (error: any) {
      console.error("Failed to update role", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update role";
      toast.error(errorMessage);
    }
  };

  // Save all changes to backend
  const saveAllChanges = useCallback(async () => {
    if (!canWrite) {
      toast.error("You don't have permission to save RBAC changes");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      // Save permissions for each role (including data access levels for Employees sections)
      const savePromises = roles
        .filter((role) => role.id !== "system_admin")
        .map(async (role) => {
          const rolePermissions: {
            [sectionKey: string]: {
              read: boolean;
              write: boolean;
              delete: boolean;
              dataAccessLevel?: number;
            };
          } = {};

          // Collect all permissions for this role across all sections
          Object.keys(permissions).forEach((sectionKey) => {
            if (permissions[sectionKey][role.id]) {
              const permissionData: {
                read: boolean;
                write: boolean;
                delete: boolean;
                dataAccessLevel?: number;
              } = {
                read: permissions[sectionKey][role.id].read,
                write: permissions[sectionKey][role.id].write,
                delete: permissions[sectionKey][role.id].delete,
              };

              // Add data access level for Employees sections
              if (
                isEmployeesSection(sectionKey) &&
                dataAccessLevels[sectionKey]?.[role.id]
              ) {
                permissionData.dataAccessLevel =
                  dataAccessLevels[sectionKey][role.id];
              }

              rolePermissions[sectionKey] = permissionData;
            }
          });

          // Bulk update permissions for this role
          if (Object.keys(rolePermissions).length > 0) {
            await axiosInstance.put("/role-permissions/bulk", {
              roleId: role.id,
              permissions: rolePermissions,
            });
          }
        });

      await Promise.all(savePromises);

      setLastSaved(new Date().toLocaleString());
      setSaveStatus("saved");
      toast.success("Permissions saved successfully");

      // Clear permissions cache for all users
      // On next page refresh, fresh permissions will be fetched
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("permissions:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error(
        error.response?.data?.message || "Failed to save permissions"
      );
      setSaveStatus("idle");
    } finally {
      setIsSaving(false);
      // Reset save status after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }
  }, [roles, permissions, dataAccessLevels, canWrite]);

  // Export all config
  const exportAllConfig = () => {
    const config = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      roles: roles,
      permissions: permissions,
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rbac-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Configuration exported successfully");
  };

  // Render menu items recursively
  const renderMenuItems = (items: MenuItem[], level: number = 0) => {
    return items.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isClickable = item.items || !hasChildren;
      const isExpanded = expandedMenus.has(item.id);
      const isSelected = selectedMenuItem === item.id;
      const paddingLeft = level * 16 + 12;

      return (
        <div key={item.id} className="menu-item-container">
          <div
            className={`menu-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
              isClickable ? "" : "font-medium"
            } ${
              isSelected ? "selected bg-blue-50 border-l-3 border-blue-600" : ""
            } hover:bg-gray-50`}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => {
              if (isClickable && item.items) {
                selectSection(item.items[0], item.name);
              } else if (hasChildren) {
                toggleMenuExpand(item.id);
              }
            }}
          >
            {hasChildren ? (
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transform transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            ) : (
              <span className="w-4" />
            )}
            {item.icon && (
              <svg
                className={`w-5 h-5 ${
                  level === 0 ? "text-blue-600" : "text-gray-500"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={item.icon}
                />
              </svg>
            )}
            <span
              className={`text-sm ${
                level === 0 ? "font-semibold text-gray-800" : "text-gray-700"
              }`}
            >
              {item.name}
            </span>
            {item.sensitive && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Sensitive
              </span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="menu-children">
              {renderMenuItems(item.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Convert icon component to SVG path string (helper function)
  const iconToPath = (iconName: string): string => {
    // Common icon paths - you can extend this as needed
    const iconPaths: { [key: string]: string } = {
      Home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      Users:
        "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      Logs: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
      Settings:
        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
      Bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
      FileSignature:
        "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    };
    return iconPaths[iconName] || "";
  };

  // Build menu structure dynamically from sidebar config (excluding recruitment)
  const getMenuStructure = (): MenuItem[] => {
    // Sidebar menu items (excluding recruitment)
    const sidebarMenuItems: MenuItem[] = [];

    // Add other sidebar items (excluding recruitment)
    // Dashboard
    sidebarMenuItems.push({
      id: "dashboard",
      name: "Dashboard",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      items: ["dashboard"],
    });

    // Employees - merged with Employee field sections
    sidebarMenuItems.push({
      id: "employees",
      name: "Employees",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      children: [
        // Employees list page
        {
          id: "employees-list",
          name: "Employees List",
          items: ["employees"],
        },
        // Employee field sections from org config
        ...parentSections.map((section) => ({
          id: section.sectionKey,
          name: section.sectionLabel,
          items: [section.sectionKey],
        })),
      ],
    });

    // My Contract Approvals
    sidebarMenuItems.push({
      id: "my-contract-approvals",
      name: "My Contract Approvals",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      items: ["my-contract-approvals"],
    });

    // Contract Approvals (admin view)
    sidebarMenuItems.push({
      id: "contract-approvals",
      name: "Contract Approvals",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      items: ["contract-approvals"],
    });

    // Generate Contract (button permission in Employee details)
    sidebarMenuItems.push({
      id: "generate-contract",
      name: "Generate Contract",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      items: ["generate-contract"],
    });

    // Audit Trail
    sidebarMenuItems.push({
      id: "audits",
      name: "Audit Trail",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
      items: ["audits"],
    });

    // Notifications
    sidebarMenuItems.push({
      id: "notifications",
      name: "Notifications",
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
      items: ["notifications"],
    });

    // Configurations (with all children)
    sidebarMenuItems.push({
      id: "configs",
      name: "Configurations",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
      children: [
        { id: "departments", name: "Departments", items: ["departments"] },
        { id: "positions", name: "Job Titles", items: ["job-titles"] },
        { id: "fields", name: "Fields", items: ["fields"] },
        { id: "documents", name: "Documents", items: ["config-documents"] },
        { id: "contracts", name: "Contracts", items: ["contracts"] },
        {
          id: "industry-awards",
          name: "Industry Awards",
          items: ["industry-awards"],
        },
        {
          id: "industry-details",
          name: "Organisation Details",
          items: ["organisation-details"], // Backend RBAC uses "organisation-details" as the permission section key
        },
        {
          id: "payroll-settings",
          name: "Payroll Settings",
          items: ["payroll-settings"],
        },
        {
          id: "employment-settings",
          name: "Employment Settings",
          items: ["employment-settings"],
        },
        {
          id: "personal-settings",
          name: "Personal Settings",
          items: ["personal-settings"],
        },
        {
          id: "rbac",
          name: "Role Management",
          items: ["rbac"],
        },
        {
          id: "role-levels",
          name: "Role Level Management",
          items: ["role-levels"],
        },
      ],
    });

    return sidebarMenuItems;
  };

  // Check if current section belongs to Employees module
  const isEmployeesSection = (sectionKey: string | null): boolean => {
    if (!sectionKey) return false;

    // Check if section is "employees" or is in parentSections (employee field sections)
    if (sectionKey === "employees") return true;

    const isParentSection = parentSections.some(
      (s) => s.sectionKey === sectionKey
    );
    return isParentSection;
  };

  // Update data access level for a role in a section
  const updateDataAccessLevel = (
    sectionKey: string,
    roleId: string,
    level: number
  ) => {
    setDataAccessLevels((prev) => {
      const next = { ...prev };
      if (!next[sectionKey]) {
        next[sectionKey] = {};
      }
      next[sectionKey][roleId] = level;
      return next;
    });
  };

  // Get current section name
  const getCurrentSectionName = () => {
    if (!currentSection) return "Select a Section";
    const section = parentSections.find((s) => s.sectionKey === currentSection);
    if (section) return section.sectionLabel;

    // Fallback for non-parent sections (like audit-trail, configurations)
    const findItem = (items: MenuItem[]): MenuItem | null => {
      for (const item of items) {
        if (item.items && item.items.includes(currentSection)) {
          return item;
        }
        if (item.children) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    const item = findItem(getMenuStructure());
    return item ? item.name : "Select a Section";
  };

  return (
    <PermissionGuard
      section="rbac"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="bg-gray-50 min-h-screen">
        <div className="flex h-screen">
          {/* Left Sidebar - Menu Tree */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Menu Sections
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Select a section to configure permissions
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {isLoadingSections ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              ) : (
                renderMenuItems(getMenuStructure())
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {getCurrentSectionName()}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {currentSection
                      ? getBreadcrumb(currentSection, getMenuStructure()) ||
                        "Configure permissions"
                      : "Choose a menu item from the left to configure permissions"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {canWrite && (
                    <>
                      <Button
                        onClick={() => setShowAddRoleModal(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Role
                      </Button>
                      <Button
                        onClick={() => setShowManageRolesModal(true)}
                        variant="outline"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Manage Roles
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">
                      Permissions:
                    </span>
                    <span className="text-xs text-gray-500 italic">
                      (System Admin has full access to all sections)
                    </span>
                  </div>
                  {permissionTypes.map((perm) => {
                    const Icon = perm.icon;
                    const permColorMap: Record<string, string> = {
                      blue: "bg-blue-500",
                      amber: "bg-amber-500",
                      red: "bg-red-500",
                    };
                    return (
                      <div key={perm.id} className="flex items-center gap-1">
                        <div
                          className={`w-7 h-7 ${
                            permColorMap[perm.color]
                          } rounded flex items-center justify-center`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs text-gray-600 ml-1">
                          {perm.name}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-1 ml-4">
                    <div className="w-7 h-7 bg-gray-200 rounded flex items-center justify-center">
                      <X className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-xs text-gray-500 ml-1">
                      No Access
                    </span>
                  </div>
                </div>
                <button
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  onClick={() => setShowEmployeeLevelsModal(true)}
                >
                  <Info className="w-4 h-4" />
                  View Employee Levels
                </button>
              </div>
            </div>

            {/* Permissions Table */}
            <div className="flex-1 overflow-auto p-6 scrollbar-thin">
              {currentSection ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                            Permission
                          </th>
                          {roles
                            .filter((role) => role.id !== "system_admin")
                            .map((role) => {
                              const roleColors =
                                colorClasses[
                                  role.color as keyof typeof colorClasses
                                ];
                              return (
                                <th
                                  key={role.id}
                                  className="px-4 py-3 text-center role-column min-w-[100px]"
                                >
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-8 h-8 ${roleColors.bg100} rounded-full flex items-center justify-center mb-1`}
                                    >
                                      <User
                                        className={`w-4 h-4 ${roleColors.text600}`}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                                      {role.name}
                                    </span>
                                  </div>
                                </th>
                              );
                            })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {permissionTypes.map((perm) => {
                          const Icon = perm.icon;
                          const permColorMap: Record<
                            string,
                            { bg100: string; bg500: string; text600: string }
                          > = {
                            blue: {
                              bg100: "bg-blue-100",
                              bg500: "bg-blue-500",
                              text600: "text-blue-600",
                            },
                            amber: {
                              bg100: "bg-amber-100",
                              bg500: "bg-amber-500",
                              text600: "text-amber-600",
                            },
                            red: {
                              bg100: "bg-red-100",
                              bg500: "bg-red-500",
                              text600: "text-red-600",
                            },
                          };
                          const permColors = permColorMap[perm.color];
                          return (
                            <React.Fragment key={perm.id}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-4 sticky left-0 bg-white z-10">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-9 h-9 ${permColors.bg100} rounded-lg flex items-center justify-center`}
                                    >
                                      <Icon
                                        className={`w-5 h-5 ${permColors.text600}`}
                                      />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {perm.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {perm.desc}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                {roles
                                  .filter((role) => role.id !== "system_admin")
                                  .map((role) => {
                                    const isActive =
                                      permissions[currentSection]?.[role.id]?.[
                                        perm.id as "read" | "write" | "delete"
                                      ] || false;
                                    return (
                                      <td
                                        key={role.id}
                                        className="px-4 py-4 text-center"
                                      >
                                        <button
                                          onClick={() =>
                                            togglePermission(
                                              currentSection,
                                              role.id,
                                              perm.id as
                                                "read" | "write" | "delete"
                                            )
                                          }
                                          className={`permission-btn w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                            isActive
                                              ? `${permColors.bg500} text-white shadow-md hover:scale-110`
                                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                          }`}
                                        >
                                          {isActive ? (
                                            <Check className="w-5 h-5" />
                                          ) : (
                                            <X className="w-5 h-5" />
                                          )}
                                        </button>
                                      </td>
                                    );
                                  })}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        {/* Data Access Level Row - Only for Employees sections, shown once after all permission rows */}
                        {isEmployeesSection(currentSection) && (
                          <tr className="bg-blue-50 border-t border-blue-200">
                            <td className="px-4 py-3 sticky left-0 bg-blue-50 z-10">
                              <div className="flex items-center gap-3 pl-12">
                                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                  <Users className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-700">
                                    Data Access Level
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Max employee level this role can access
                                  </div>
                                </div>
                              </div>
                            </td>
                            {roles
                              .filter((role) => role.id !== "system_admin")
                              .map((role) => (
                                <td
                                  key={role.id}
                                  className="px-4 py-3 text-center"
                                >
                                  <div className="flex items-center justify-center">
                                    <select
                                      value={
                                        dataAccessLevels[currentSection]?.[
                                          role.id
                                        ] ||
                                        role.level ||
                                        1
                                      }
                                      onChange={(e) => {
                                        const level = parseInt(e.target.value);
                                        updateDataAccessLevel(
                                          currentSection,
                                          role.id,
                                          level
                                        );
                                      }}
                                      disabled={!canWrite}
                                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed min-w-[100px]"
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                                        <option key={level} value={level}>
                                          Level {level}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                              ))}
                          </tr>
                        )}
                        {/* Quick Actions Row */}
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td className="px-4 py-3 sticky left-0 bg-gray-50 z-10">
                            <span className="text-sm font-medium text-gray-600">
                              Quick Actions
                            </span>
                          </td>
                          {roles
                            .filter((role) => role.id !== "system_admin")
                            .map((role) => (
                              <td
                                key={role.id}
                                className="px-4 py-3 text-center"
                              >
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() =>
                                      setAllPermissions(
                                        currentSection,
                                        role.id,
                                        true
                                      )
                                    }
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                    title="Grant All"
                                  >
                                    All
                                  </button>
                                  <button
                                    onClick={() =>
                                      setAllPermissions(
                                        currentSection,
                                        role.id,
                                        false
                                      )
                                    }
                                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    title="Revoke All"
                                  >
                                    None
                                  </button>
                                </div>
                              </td>
                            ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Settings className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium">
                    Select a section from the menu
                  </p>
                  <p className="text-sm">
                    Choose a menu item on the left to configure its permissions
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Last saved: {lastSaved}
                  </span>
                  <button
                    onClick={resetCurrentSection}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Section
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={exportAllConfig}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export All
                  </Button>
                  <Button
                    onClick={saveAllChanges}
                    className={`flex items-center gap-2 ${
                      saveStatus === "saved"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                    disabled={isSaving || !canWrite}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : saveStatus === "saved" ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save All Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Role Modal */}
        <Transition show={showAddRoleModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowAddRoleModal(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Add New Role
                        </Dialog.Title>
                        <button
                          onClick={() => setShowAddRoleModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role Name
                          </label>
                          <Input
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="e.g., Finance Manager"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <Textarea
                            value={newRoleDesc}
                            onChange={(e) => setNewRoleDesc(e.target.value)}
                            rows={2}
                            placeholder="Brief description of this role..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employee Level
                          </label>
                          <select
                            value={newRoleLevel}
                            onChange={(e) =>
                              setNewRoleLevel(parseInt(e.target.value))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {roleLevels.length > 0 ? (
                              roleLevels.map((level) => (
                                <option key={level._id} value={level.level}>
                                  Level {level.level} - {level.name}
                                </option>
                              ))
                            ) : (
                              <option value={1}>Level 1</option>
                            )}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Employee level determines data access level for this
                            role
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Icon Color
                          </label>
                          <div className="flex gap-2">
                            {roleColors.map((color) => {
                              const colorMap: Record<string, string> = {
                                purple: "bg-purple-500",
                                blue: "bg-blue-500",
                                green: "bg-green-500",
                                amber: "bg-amber-500",
                                red: "bg-red-500",
                                pink: "bg-pink-500",
                                teal: "bg-teal-500",
                                gray: "bg-gray-500",
                              };
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setSelectedRoleColor(color)}
                                  className={`w-8 h-8 rounded-full ${
                                    colorMap[color]
                                  } border-2 transition-all ${
                                    selectedRoleColor === color
                                      ? "border-gray-800 ring-2 ring-offset-2"
                                      : "border-transparent hover:border-gray-400"
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => setShowAddRoleModal(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={addNewRole}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Add Role
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Manage Roles Modal */}
        <Transition show={showManageRolesModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowManageRolesModal(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Manage Roles
                        </Dialog.Title>
                        <button
                          onClick={() => setShowManageRolesModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {roles.map((role, index) => {
                          const roleColors =
                            colorClasses[
                              role.color as keyof typeof colorClasses
                            ];
                          return (
                            <div
                              key={role.id}
                              className={`flex items-center justify-between py-3 ${
                                index > 0 ? "border-t border-gray-100" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 ${roleColors.bg100} rounded-full flex items-center justify-center`}
                                >
                                  <User
                                    className={`w-5 h-5 ${roleColors.text600}`}
                                  />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {role.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {role.desc || "No description"}
                                  </div>
                                  {role.level && (
                                    <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                      <span>Level {role.level}</span>
                                      {roleLevels.length > 0 && (
                                        <span className="text-gray-400">
                                          -{" "}
                                          {roleLevels.find(
                                            (rl) => rl.level === role.level
                                          )?.name || ""}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-mono">
                                  {role.id}
                                </span>
                                {role.id !== "system_admin" ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        openEditRoleModal(role);
                                        setShowManageRolesModal(false);
                                      }}
                                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit Role"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        deleteRole(role.id);
                                        setShowManageRolesModal(false);
                                      }}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Role"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 px-2">
                                    Protected
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                        <Button onClick={() => setShowManageRolesModal(false)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Edit Role Modal */}
        <Transition show={showEditRoleModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowEditRoleModal(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Edit Role
                        </Dialog.Title>
                        <button
                          onClick={() => setShowEditRoleModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role Name *
                          </label>
                          <Input
                            value={editRoleName}
                            onChange={(e) => setEditRoleName(e.target.value)}
                            placeholder="e.g., HR Manager"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <Textarea
                            value={editRoleDesc}
                            onChange={(e) => setEditRoleDesc(e.target.value)}
                            placeholder="Brief description of the role"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role Level
                          </label>
                          <select
                            value={editRoleLevel}
                            onChange={(e) =>
                              setEditRoleLevel(Number(e.target.value))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {roleLevels.map((level) => (
                              <option key={level._id} value={level.level}>
                                Level {level.level} - {level.name}
                              </option>
                            ))}
                            {roleLevels.length === 0 && (
                              <>
                                <option value={1}>Level 1</option>
                                <option value={2}>Level 2</option>
                                <option value={3}>Level 3</option>
                                <option value={4}>Level 4</option>
                                <option value={5}>Level 5</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Role Color
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {roleColors.map((color) => {
                              const clr =
                                colorClasses[
                                  color as keyof typeof colorClasses
                                ];
                              return (
                                <button
                                  key={color}
                                  onClick={() => setEditRoleColor(color)}
                                  className={`w-8 h-8 rounded-full ${clr.bg500} ${
                                    editRoleColor === color
                                      ? "ring-2 ring-offset-2 ring-gray-400"
                                      : ""
                                  } transition-all`}
                                  title={color}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => setShowEditRoleModal(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={editRole}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Employee Levels Modal */}
        <Transition show={showEmployeeLevelsModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowEmployeeLevelsModal(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-lg font-semibold text-white">
                          Employee Levels
                        </Dialog.Title>
                        <button
                          onClick={() => setShowEmployeeLevelsModal(false)}
                          className="text-white hover:text-gray-200 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Introductory Text */}
                      <p className="text-sm text-gray-600 mb-6">
                        Employees are categorised into levels based on their
                        position in the organisation. Configure which level of
                        employee data each role can access.
                      </p>

                      {/* Employee Levels List */}
                      <div className="space-y-3">
                        {isLoadingRoleLevels ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          </div>
                        ) : roleLevels.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No role levels configured. Please add levels in Role
                            Level Management.
                          </div>
                        ) : (
                          roleLevels.map((level) => {
                            // Determine color based on level number
                            let colorClass = "bg-gray-200 text-gray-700";
                            if (level.level <= 3) {
                              colorClass = "bg-blue-100 text-blue-700";
                            } else if (level.level <= 5) {
                              colorClass = "bg-purple-100 text-purple-700";
                            } else {
                              colorClass = "bg-purple-200 text-purple-800";
                            }
                            return (
                              <div
                                key={level._id}
                                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                              >
                                {/* Level Icon */}
                                <div
                                  className={`w-12 h-12 ${colorClass} rounded-full flex items-center justify-center font-semibold text-lg flex-shrink-0`}
                                >
                                  {level.level}
                                </div>
                                {/* Level Info */}
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    Level {level.level}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-0.5">
                                    {level.name}
                                  </div>
                                  {level.description && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {level.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer Button */}
                      <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                        <Button
                          onClick={() => setShowEmployeeLevelsModal(false)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Got it
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </PermissionGuard>
  );
}
