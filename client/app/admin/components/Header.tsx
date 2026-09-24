"use client";

import { Bell, Cog } from "lucide-react";
import { useAppSelector } from "@/app/store/hook";

export default function AdminHeader() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="w-full flex justify-between items-center py-4 px-6 bg-white border-b">
      {/* Left side - Admin info */}
      <div className="ml-2">
        <h2 className="text-lg font-semibold text-gray-900">Platform Admin</h2>
        {user && <p className="text-sm text-gray-500">{user.email}</p>}
      </div>

      {/* Right side - Icons */}
      <div className="flex items-center gap-4">
        <span className="w-10 h-10 bg-[#F6F8FD] flex items-center justify-center rounded-full cursor-pointer hover:bg-[#E8ECF5] transition-colors">
          <Cog className="text-gray-400 w-5 h-5" />
        </span>
        <span className="w-10 h-10 bg-[#FFF1F1] flex items-center justify-center rounded-full cursor-pointer hover:bg-[#FFE5E5] transition-colors">
          <Bell className="text-[#F04438] w-5 h-5" />
        </span>
      </div>
    </div>
  );
}
