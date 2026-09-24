// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import Image from "next/image";
// import { Button } from "rizzui";
// import {
//   User,
//   MailOpen,
//   Building,
//   LogOut,
//   ChevronDown,
//   ChevronUp,
// } from "lucide-react";
// import { cn } from "@/app/lib/utils";
// import { useAppDispatch } from "@/app/store/hook";
// import { logoutUser } from "@/app/store/slices/authSlice";

// const navItems = [
//   { label: "My Profile", icon: User, href: "/nexus-profile" },
//   {
//     label: "Nexus Profile Organizations",
//     icon: Building,
//     href: "/nexus-profile/organizations",
//   },
//   {
//     label: "All Invitations",
//     icon: MailOpen,
//     href: "/nexus-profile/invitations",
//   },
// ];

// export default function EmployeeSidebar() {
//   const dispatch = useAppDispatch();
//   const pathname = usePathname();
//   const [showTenants, setShowTenants] = useState(false);
//   const [currentTenant, setCurrentTenant] = useState("Acme Corp");

//   const tenantList = ["Acme Corp", "Beta Inc", "Gamma LLC"]; // Replace with real data

//   const handleLogout = () => {
//     dispatch(logoutUser());
//   };

//   const handleTenantSwitch = (tenant: string) => {
//     setCurrentTenant(tenant);
//     setShowTenants(false);
//     // TODO: Trigger tenant switch logic
//   };

//   const isActivePath = (href: string) =>
//     pathname === href || pathname.startsWith(`${href}/`);

//   return (
//     <aside className="h-screen w-64 bg-primary text-white flex flex-col justify-between rounded-tr-3xl rounded-br-3xl shadow-lg overflow-hidden">
//       {/* Top - Organization Switcher */}
//       <div>
//         <div className="px-6 py-6 border-b border-white/10">
//           <button
//             onClick={() => setShowTenants(!showTenants)}
//             className="w-full text-left flex items-center justify-between text-white font-semibold text-base"
//           >
//             <span>Nexus Profile</span>
//             {/* {showTenants ? <ChevronUp size={18} /> : <ChevronDown size={18} />} */}
//           </button>
//         </div>

//         {/* Nav */}
//         <nav className="mt-4 px-2 space-y-1">
//           {navItems.map((item) => {
//             const Icon = item.icon;
//             const isActive = isActivePath(item.href);

//             return (
//               <Link
//                 key={item.href}
//                 href={item.href}
//                 className={cn(
//                   "flex items-center gap-3 px-4 py-3 text-[13px] font-medium rounded-xl transition",
//                   isActive
//                     ? "bg-white text-primary font-semibold"
//                     : "hover:bg-white/10"
//                 )}
//               >
//                 <Icon size={18} />
//                 <span>{item.label}</span>
//               </Link>
//             );
//           })}
//         </nav>
//       </div>

//       {/* Bottom user section */}
//       <div className="bg-white/10 px-4 py-3 flex items-center gap-3 text-white">
//         <Image
//           src="/avatar.png"
//           alt="User Avatar"
//           width={36}
//           height={36}
//           className="rounded-full"
//         />
//         <div className="flex-1">
//           <p className="text-sm font-medium leading-none">John Doe</p>
//           <p className="text-xs opacity-80">johndoe@example.com</p>
//         </div>
//         <LogOut
//           size={16}
//           className="opacity-70 hover:opacity-100 cursor-pointer"
//           onClick={handleLogout}
//         />
//       </div>
//     </aside>
//   );
// }

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LogOut,
  Pin,
  PinOff,
  User,
  MailOpen,
  Building,
  Bell,
  FileSignature,
  FileText,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useAppDispatch } from "@/app/store/hook";
import { logoutUser } from "@/app/store/slices/authSlice";

const navItems = [
  // { label: "My Profile", icon: User, href: "/nexus-profile" },
  {
    label: "My Organisations",
    icon: Building,
    href: "/nexus-profile/organizations",
  },
  {
    label: "All Invitations",
    icon: MailOpen,
    href: "/nexus-profile/invitations",
  },
  {
    label: "Notifications",
    icon: Bell,
    href: "/nexus-profile/notifications",
  },
  {
    label: "My Contracts",
    icon: FileText,
    href: "/my-contracts",
  },
];

export default function EmployeeSidebar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);

  const handleLogout = () => dispatch(logoutUser());
  const isActivePath = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Helpers to switch classes based on pinned/hovered (open) state
  const containerWidthCls = pinned ? "w-64" : "w-16 hover:w-64";
  const justifyCls = pinned
    ? "justify-start"
    : "justify-center group-hover:justify-start";
  const showTextCls = (max: number) =>
    pinned
      ? `max-w-[${max}px] opacity-100 translate-x-0`
      : `max-w-0 overflow-hidden opacity-0 translate-x-2 group-hover:max-w-[${max}px] group-hover:opacity-100 group-hover:translate-x-0`;

  return (
    <aside
      className={cn(
        "group h-screen",
        containerWidthCls,
        "transition-[width] duration-300 ease-out",
        "bg-primary text-white flex flex-col justify-between",
        "rounded-tr-3xl rounded-br-3xl shadow-lg overflow-hidden"
      )}
    >
      {/* Top */}
      <div>
        <div className="px-3 py-6 border-b border-white/10">
          <div className={cn("flex items-center gap-3")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
              N
            </div>

            {/* Title reveals only when open (hover or pinned) */}
            <span
              className={cn(
                showTextCls(200),
                "transition-all duration-300 ease-out",
                "text-white font-semibold text-base whitespace-nowrap"
              )}
            >
              Nexus Profile
            </span>

            {/* Pin toggle: visible only when open (pinned OR hover-expanded) */}
            <button
              onClick={() => setPinned((p) => !p)}
              className={cn(
                "ml-auto rounded-lg p-1.5 hover:bg-white/10 transition-colors",
                pinned ? "bg-white/15" : "",
                pinned ? "inline-flex" : "hidden group-hover:inline-flex",
                pinned
                  ? ""
                  : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
              )}
              title={pinned ? "Unpin sidebar" : "Pin sidebar"}
              aria-pressed={pinned}
            >
              {pinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 text-[13px] font-medium rounded-xl transition-colors",
                  justifyCls,
                  isActive
                    ? "bg-white text-primary font-semibold"
                    : "hover:bg-white/10"
                )}
              >
                <Icon size={20} />
                {/* Label reveals only when open */}
                <span
                  className={cn(
                    showTextCls(180),
                    "transition-all duration-300 ease-out",
                    "whitespace-nowrap"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom user section */}
      <div className="bg-white/10 px-3 py-3 flex items-center gap-3 text-white">
        {/* <Image
          src="/avatar.png"
          alt="User Avatar"
          width={36}
          height={36}
          className="rounded-full shrink-0"
        /> */}
        <div
          className={cn(
            showTextCls(220),
            "transition-all duration-300 ease-out"
          )}
        >
          {/* <p className="text-sm font-medium leading-none">John Doe</p>
          <p className="text-xs opacity-80 truncate">johndoe@example.com</p> */}
        </div>
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
