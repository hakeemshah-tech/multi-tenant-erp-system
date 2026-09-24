"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "../store/slices/authSlice";
import Sidebar from "./components/Sidebar";
import Header from "../components/shared/Header";
import { useAppDispatch, useAppSelector } from "../store/hook";

export default function NexusProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!user) dispatch(getProfile());
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
