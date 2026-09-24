"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "../store/slices/authSlice";
import Sidebar from "../nexus-profile/components/Sidebar";
import Header from "../components/shared/Header";
import { useAppDispatch, useAppSelector } from "../store/hook";

export default function MyContractApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!user) {
      dispatch(getProfile());
      return;
    }

    // Allow access to this page for all authenticated users
    // The backend will filter approvals by employeeId
    const currentMode = user?.currentMode;
    const roles = user.assignments?.map((a) => a.role) || [];
    const isEmployeeProfileCreated = user?.isEmployeeProfileCreated;

    // If user is a tenant-owner/admin, they might want to use the tenant route instead
    // But we'll allow them here too for consistency
    if (roles.includes("tenant-owner") || user.role === "admin") {
      // Allow access - they can see their own approvals if they're also employees
      return;
    }

    // For employees and nexus profiles, allow access
    if (
      isEmployeeProfileCreated === true ||
      roles.includes("employee") ||
      currentMode === "nexus-profile"
    ) {
      return;
    }

    // For newbies, redirect to onboarding
    if (currentMode === "newbie") {
      router.replace("/onboarding");
      return;
    }

    // Fallback: redirect to login if not authenticated
    if (!user) {
      router.replace("/login");
    }
  }, [user, dispatch, router]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 bg-gray-50 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
