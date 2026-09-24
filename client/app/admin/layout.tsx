"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getProfile } from "../store/slices/authSlice";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { useAppDispatch, useAppSelector } from "../store/hook";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!user) {
      dispatch(getProfile());
      return;
    }

    // Check if user is platform admin
    if (!user.isPlatformAdmin && user.role !== "platform-admin") {
      router.replace("/login");
      return;
    }
  }, [user, dispatch, router]);

  // Don't render layout if user is not admin (will redirect)
  if (user && !user.isPlatformAdmin && user.role !== "platform-admin") {
    return null;
  }

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
