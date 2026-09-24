"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import {
  BuildingOfficeIcon,
  BriefcaseIcon,
  EyeIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { useAppDispatch } from "@/app/store/hook";
import { getProfile } from "@/app/store/slices/authSlice";
import { usePermissions } from "@/app/hooks/usePermissions";

interface Organization {
  _id: string;
  designation?: { name: string };
  branchId?: {
    _id: string;
    name: string;
    logo?: string | { fileId: string; key?: string };
  };
  additionalRoleIds?:
    | Array<{ roleId: string; name: string; color?: string; level?: number }>
    | string[];
  additionalDesignationIds?: Array<{ _id: string; name: string } | string>;
}

interface OrganizationWithLogo extends Organization {
  logoUrl?: string | null;
}

function OrganizationCard({
  org,
  router,
  onManage,
  isSwitching,
}: {
  org: OrganizationWithLogo;
  router: ReturnType<typeof useRouter>;
  onManage: (branchId: string) => void;
  isSwitching: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const showLogo = org.logoUrl && !imageError;

  // Get additional roles - they should already be populated from the API
  const additionalRoleIds = org.additionalRoleIds || [];
  const additionalRoles = additionalRoleIds
    .map((role: { roleId: string; name: string } | string) => {
      // If already populated (object), return as is
      if (typeof role === "object" && role.name) {
        return { roleId: role.roleId, name: role.name };
      }
      // If still a string (fallback), return null (shouldn't happen if API populates correctly)
      return null;
    })
    .filter((r): r is { roleId: string; name: string } => r !== null);

  // Get additional designations - they should already be populated from the API
  const additionalDesignationIds = org.additionalDesignationIds || [];
  const additionalDesignations = additionalDesignationIds
    .map((d: { _id: string; name: string } | string) => {
      // If already populated (object), return as is
      if (typeof d === "object" && d.name) {
        return { _id: d._id || String(d), name: d.name };
      }
      // If still a string (fallback), return null (shouldn't happen if API populates correctly)
      return null;
    })
    .filter((d): d is { _id: string; name: string } => d !== null);

  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        {/* Logo and Organization Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            {showLogo ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 bg-white flex items-center justify-center">
                <Image
                  src={org.logoUrl!}
                  alt={org.branchId?.name || "Organization"}
                  width={64}
                  height={64}
                  className="object-contain w-full h-full"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 flex items-center justify-center">
                <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {org.branchId?.name || "Unknown Organization"}
            </h3>
            {org.designation?.name && (
              <div className="flex items-center gap-1.5 mt-1">
                <BriefcaseIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-600 truncate">
                  {org.designation.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Roles and Job Titles */}
        {(additionalRoles.length > 0 || additionalDesignations.length > 0) && (
          <div className="mb-4 pt-4 border-t border-gray-200">
            {additionalRoles.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 font-medium uppercase mb-2">
                  Additional Roles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {additionalRoles.map((role) => (
                    <span
                      key={role.roleId}
                      className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded"
                    >
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {additionalDesignations.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase mb-2">
                  Additional Job Titles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {additionalDesignations.map((designation) => (
                    <span
                      key={designation._id}
                      className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded"
                    >
                      <BriefcaseIcon className="w-2.5 h-2.5" />
                      {designation.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
            onClick={() =>
              router.push(`/nexus-profile/organizations/${org.branchId?._id}`)
            }
          >
            <EyeIcon className="w-4 h-4 mr-1.5" />
            View Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => org.branchId?._id && onManage(org.branchId._id)}
            disabled={isSwitching}
          >
            <Cog6ToothIcon className="w-4 h-4 mr-1.5" />
            {isSwitching ? "Switching..." : "Manage"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function MyOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [logoUrls, setLogoUrls] = useState<{
    [branchId: string]: string | null;
  }>({});
  const [loading, setLoading] = useState(false);
  const [switchingContext, setSwitchingContext] = useState<string | null>(null); // branchId being switched to
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { setPermissions } = usePermissions();

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/employee-profiles/my-organizations/get"
      );
      const orgs = res.data.data || [];
      setOrganizations(orgs);
    } catch (error) {
      console.error("Failed to fetch organizations", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch logo URLs for organizations
  useEffect(() => {
    const fetchLogoUrls = async () => {
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

      setLogoUrls(logoUrlMap);
    };

    if (organizations.length > 0) {
      fetchLogoUrls();
    }
  }, [organizations]);

  // Handle context switching when clicking "Manage"
  const handleManageOrganization = async (branchId: string) => {
    if (!branchId) return;

    setSwitchingContext(branchId);
    try {
      // Call context switching endpoint
      const res = await axiosInstance.post(
        "/auth/switch-organization-context",
        {
          branchId,
        }
      );

      // Store permissions in the hook
      // The response structure is: { activeAssignment, aggregatedRoles, permissions }
      if (res.data.data) {
        setPermissions({
          aggregatedRoles: res.data.data.aggregatedRoles,
          permissions: res.data.data.permissions,
        });
      }

      // Refresh user profile to get updated activeAssignment
      await dispatch(getProfile());

      // Show success message
      toast.success("Switched to organization context");

      // Redirect to tenant dashboard
      router.push("/tenant/dashboard");
    } catch (error: any) {
      console.error("Failed to switch organization context", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to switch to organization context. Please try again.";
      toast.error(errorMessage);
    } finally {
      setSwitchingContext(null);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const organizationsWithLogos: OrganizationWithLogo[] = useMemo(() => {
    return organizations.map((org) => ({
      ...org,
      logoUrl: org.branchId?._id ? logoUrls[org.branchId._id] : null,
    }));
  }, [organizations, logoUrls]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Organizations</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your organization profiles and access
        </p>
      </div>

      {organizationsWithLogos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizationsWithLogos.map((org) => (
            <OrganizationCard
              key={org._id}
              org={org}
              router={router}
              onManage={handleManageOrganization}
              isSwitching={switchingContext === org.branchId?._id}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <BuildingOfficeIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium text-base mb-1">
              No organizations found
            </p>
            <p className="text-gray-500 text-sm">
              You are not linked to any organization yet.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
