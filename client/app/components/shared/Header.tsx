// "use client";

// import { Bell, Cog } from "lucide-react";
// // import Image from "next/image";
// import SearchInput from "../ui/SearchInput";

// export default function Header() {
//   return (
//     <div className="w-full flex justify-between items-center py-4 px-6 bg-white">
//       {/* Search Bar */}
//       {/* <div className="flex-1 max-w-sm">
//         <SearchInput />
//       </div> */}

//       {/* Plan Info */}
//       <div className="ml-4">
//         <PlanStatus />
//       </div>

//       {/* Icons */}
//       <div className="flex items-center gap-4 ml-4">
//         <span className="w-10 h-10 bg-[#F6F8FD] flex items-center justify-center rounded-full">
//           <Cog className="text-gray-400 w-5 h-5" />
//         </span>
//         <span className="w-10 h-10 bg-[#FFF1F1] flex items-center justify-center rounded-full">
//           <Bell className="text-[#F04438] w-5 h-5" />
//         </span>
//         {/* Optional: Logo Icon Placeholder */}
//         {/* <span className="w-10 h-10 bg-[#F6F8FD] flex items-center justify-center rounded-full">
//           <Image src="/logo.svg" alt="Logo" width={24} height={24} />
//         </span> */}
//       </div>
//     </div>
//   );
// }
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Bell, Cog, User, Building2 } from "lucide-react";
import { Button, Modal, Title, Text, Select } from "rizzui";
import PlanStatus from "../ui/PlanStatus";
import axiosInstance from "@/app/lib/axios";
import { useAppSelector, useAppDispatch } from "@/app/store/hook";
import { useOrganizations } from "@/app/hooks/useOrganizations";
import { getProfile } from "@/app/store/slices/authSlice";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Check if we're on a template page
  const isTemplatePage = pathname?.includes("/tenant/contracts/templates/");

  const [mode, setMode] = useState<"organization" | "nexus-profile">(
    "organization"
  );
  const [isLoading, setIsLoading] = useState(false); // switch loading
  const [isEmployeeProfileCreated, setIsEmployeeProfileCreated] =
    useState<boolean>(false);
  const [isOrganizationFound, setIsOrganizationFound] =
    useState<boolean>(false);

  // NEW: confirm modal state for Create Nexus Profile flow
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Check if we're in tenant (employer) routes - should NOT call employee APIs
  const isInTenantRoute = pathname?.startsWith("/tenant");

  // Organization switcher - only on /nexus-profile/organizations/[branchId] page
  const isOnOrganizationPage =
    pathname?.startsWith("/nexus-profile/organizations/") && params?.branchId;

  // Only call useOrganizations hook if NOT in tenant routes (employee-only API)
  const { organizations, loading: organizationsLoading } =
    useOrganizations(!isInTenantRoute);

  // Get current branchId from URL params
  const currentBranchId = params?.branchId as string | undefined;

  // Find current organization
  const currentOrganization = useMemo(() => {
    if (!currentBranchId || !organizations.length) return null;
    const branchIdStr = String(currentBranchId);
    return organizations.find(
      (org) => org.branchId?._id && String(org.branchId._id) === branchIdStr
    );
  }, [organizations, currentBranchId]);

  // Check if we should show the organization switcher (multiple organizations)
  const shouldShowOrganizationSwitcher =
    isOnOrganizationPage && organizations.length > 1;

  // Handle organization switch
  const handleOrganizationSwitch = (
    selectedOrg: { label: string; value: string } | null
  ) => {
    if (!selectedOrg?.value) return;
    const newBranchId = selectedOrg.value;
    // Update URL to the new organization
    router.push(`/nexus-profile/organizations/${newBranchId}`);
  };

  // Use user from Redux state as fallback for employee profile status
  const employeeProfileCreatedFromUser =
    user && typeof user === "object" && "isEmployeeProfileCreated" in user
      ? ((user as { isEmployeeProfileCreated?: boolean })
          .isEmployeeProfileCreated ?? false)
      : false;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axiosInstance.get("/auth/profile");
        const data = res.data?.data;

        if (
          data?.currentMode === "organization" ||
          data?.currentMode === "nexus-profile"
        ) {
          setMode(data.currentMode);
        }

        setIsEmployeeProfileCreated(data?.isEmployeeProfileCreated ?? false);
        setIsOrganizationFound(data?.isOrganizationFound ?? false);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };

    fetchProfile();
  }, []);

  // Use API data if available, otherwise fallback to Redux user state
  const isEmployeeProfileCreatedFinal =
    isEmployeeProfileCreated || employeeProfileCreatedFromUser;

  const [switchingToMode, setSwitchingToMode] = useState<
    "organization" | "nexus-profile" | null
  >(null);

  const toggleMode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = e.target.checked ? "nexus-profile" : "organization";
    const previousMode = mode;
    setMode(newMode);
    setSwitchingToMode(newMode);
    setIsLoading(true);
    try {
      await axiosInstance.patch("/auth/update-mode", { currentMode: newMode });
      // Refresh user profile to get updated activeAssignment
      await dispatch(getProfile());
      router.push(newMode === "nexus-profile" ? "/nexus-profile" : "/tenant");
    } catch (err) {
      console.error("Mode switch failed:", err);
      setMode(previousMode);
      setSwitchingToMode(null);
    } finally {
      setIsLoading(false);
      // Clear switching mode after a short delay to allow animation to complete
      setTimeout(() => setSwitchingToMode(null), 300);
    }
  };

  // NEW: confirm -> create employee profile -> redirect
  const confirmCreateNexusProfile = async () => {
    try {
      setCreatingProfile(true);
      await axiosInstance.post(`/employee-profiles/self`, {});
      setIsConfirmOpen(false);
      // optional: mark locally to hide the button immediately
      setIsEmployeeProfileCreated(true);
      router.push("/nexus-profile");
    } catch (error) {
      console.error("Error creating employee profile:", error);
    } finally {
      setCreatingProfile(false);
    }
  };

  return (
    <>
      {/* Fullscreen Loading Overlay */}
      {isLoading && switchingToMode && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {/* Spinning ring */}
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              {/* Pulse effect */}
              <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-ping opacity-20"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-semibold text-gray-700 animate-pulse">
                Switching to{" "}
                {switchingToMode === "nexus-profile"
                  ? "Nexus Profile"
                  : "Organisation"}
                ...
              </p>
              <p className="text-sm text-gray-500">Please wait</p>
            </div>
          </div>
        </div>
      )}

      <div
        className={`w-full flex justify-between items-center px-6 bg-white border-b relative ${
          isTemplatePage ? "pt-4 pb-0" : "py-4"
        }`}
      >
        {/* Left side - Plan Info or Organization Switcher */}
        <div className="ml-2 flex items-center gap-4">
          {mode === "organization" && <PlanStatus />}

          {/* Organization Switcher Dropdown - only show on organization page with multiple orgs */}
          {shouldShowOrganizationSwitcher && (
            <div className="relative flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200/60 shadow-sm hover:shadow-lg hover:border-blue-300/80 transition-all duration-300 group">
              {/* Decorative gradient overlay on hover */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-100/0 via-indigo-100/0 to-purple-100/0 group-hover:from-blue-100/30 group-hover:via-indigo-100/20 group-hover:to-purple-100/30 transition-all duration-300 pointer-events-none" />

              {/* Icon container with animated background */}
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
                <Building2 className="w-5 h-5" />
              </div>

              {/* Select container */}
              <div className="relative flex flex-col z-10">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                  Switch Organization
                </label>
                <Select
                  value={
                    currentOrganization && currentOrganization.branchId?._id
                      ? {
                          label: currentOrganization.branchId.name || "Unknown",
                          value: String(currentOrganization.branchId._id),
                        }
                      : currentBranchId
                        ? {
                            label: "Loading...",
                            value: String(currentBranchId),
                          }
                        : null
                  }
                  onChange={handleOrganizationSwitch}
                  options={organizations
                    .filter((org) => org.branchId?._id)
                    .map((org) => ({
                      label: org.branchId?.name || "Unknown Organization",
                      value: org.branchId?._id ? String(org.branchId._id) : "",
                    }))
                    .filter((opt) => opt.value)}
                  disabled={organizationsLoading}
                  className="min-w-[240px] [&>button]:bg-white [&>button]:border-2 [&>button]:border-blue-200 [&>button]:hover:border-blue-400 [&>button]:shadow-sm [&>button]:hover:shadow-md [&>button]:font-semibold [&>button]:text-gray-800 [&>button]:text-sm [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-2 [&>button]:transition-all [&>button]:duration-200"
                  placeholder={
                    organizationsLoading ? "Loading..." : "Select organization"
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Right side - Buttons or switch + icons */}
        <div className="flex items-center gap-3">
          {(isEmployeeProfileCreatedFinal || isEmployeeProfileCreated) &&
          isOrganizationFound ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Organisation</span>

              {/* Custom elegant switch */}
              <label
                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 ${
                  mode === "nexus-profile" ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={mode === "nexus-profile"}
                  onChange={toggleMode}
                  disabled={isLoading}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ease-in-out ${
                    mode === "nexus-profile" ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </label>

              <span className="text-sm text-gray-600">Nexus Profile</span>
            </div>
          ) : (
            <>
              {!isOrganizationFound && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  onClick={() => router.push("/register-tenant")}
                >
                  Create Organisation
                </Button>
              )}
              {!isEmployeeProfileCreatedFinal && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-violet-600 border-violet-600 hover:bg-violet-50"
                  // OLD: router.push("/create-nexus-profile")
                  // NEW: open confirm modal
                  onClick={() => setIsConfirmOpen(true)}
                >
                  Create Nexus Profile
                </Button>
              )}
            </>
          )}

          {/* Icons - Show profile icon always (if user exists) */}
          {user != null && (
            <button
              onClick={() => router.push("/nexus-profile/profile-update")}
              className="w-10 h-10 bg-[#E8F4FD] flex items-center justify-center rounded-full hover:bg-[#D1E9F6] transition-colors cursor-pointer"
              title="Profile Update"
            >
              <User className="text-blue-600 w-5 h-5" />
            </button>
          )}
          <span className="w-10 h-10 bg-[#F6F8FD] flex items-center justify-center rounded-full">
            <Cog className="text-gray-400 w-5 h-5" />
          </span>
          <span className="w-10 h-10 bg-[#FFF1F1] flex items-center justify-center rounded-full">
            <Bell className="text-[#F04438] w-5 h-5" />
          </span>
        </div>

        {/* NEW: Confirm Dialog (same style as Onboarding) */}
        <Modal
          isOpen={isConfirmOpen}
          onClose={() => !creatingProfile && setIsConfirmOpen(false)}
          size="sm"
          rounded="lg"
        >
          <div className="m-auto px-7 pt-6 pb-7">
            <Title as="h3" className="mb-2">
              Confirm Registration
            </Title>
            <Text className="text-gray-600 mb-6">
              Are you sure you want to register as an{" "}
              <span className="font-semibold">Employee</span>?
            </Text>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                disabled={creatingProfile}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmCreateNexusProfile}
                disabled={creatingProfile}
              >
                {creatingProfile ? "Processing..." : "Yes, continue"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
