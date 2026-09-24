"use client";

import { cn } from "@/app/lib/utils";
import { useAppDispatch } from "@/app/store/hook";
import { logoutUser } from "@/app/store/slices/authSlice";
import {
  Home,
  Users,
  Building,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Shield,
  Database,
  Activity,
  Trophy,
  UserCheck,
  DollarSign,
  Building2,
  Factory,
  Layers,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

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
  baseHref?: string;
  children: NavItem[];
};

type NavItem = NavLeaf | NavGroup;

const isGroup = (item: NavItem): item is NavGroup =>
  (item as NavGroup).children !== undefined;

/* -------------------- Config -------------------- */
const navConfig: NavItem[] = [
  // {
  //   key: "dashboard",
  //   label: "Dashboard",
  //   icon: Home,
  //   href: "/admin/dashboard",
  // },
  // {
  //   key: "tenants",
  //   label: "Tenants",
  //   icon: Building,
  //   href: "/admin/tenants",
  // },
  // {
  //   key: "users",
  //   label: "Users",
  //   icon: Users,
  //   href: "/admin/users",
  // },
  {
    key: "awards-group",
    label: "Awards",
    icon: Trophy,
    baseHref: "/admin",
    children: [
      {
        key: "awards",
        label: "Awards",
        icon: Trophy,
        href: "/admin/awards",
      },
      {
        key: "award-employee-types",
        label: "Award Employee Types",
        icon: UserCheck,
        href: "/admin/award-employee-types",
      },
      {
        key: "hourly-rate-managements",
        label: "Hourly Rate Management",
        icon: DollarSign,
        href: "/admin/hourly-rate-managements",
      },
    ],
  },
  {
    key: "business-group",
    label: "Business",
    icon: Building2,
    baseHref: "/admin",
    children: [
      {
        key: "business-structures",
        label: "Business Structures",
        icon: Building2,
        href: "/admin/business-structures",
      },
      {
        key: "industry-types",
        label: "Industry Types",
        icon: Factory,
        href: "/admin/industry-types",
      },
      {
        key: "industry-sub-types",
        label: "Industry Sub Types",
        icon: Layers,
        href: "/admin/industry-sub-types",
      },
    ],
  },
  {
    key: "employment-settings-master",
    label: "Employment Settings Master",
    icon: Briefcase,
    href: "/admin/employment-settings-master",
  },
  {
    key: "personal-settings-master",
    label: "Personal Settings Master",
    icon: UserCheck,
    href: "/admin/personal-settings-master",
  },
  // {
  //   key: "system",
  //   label: "System",
  //   icon: Settings,
  //   baseHref: "/admin/system",
  //   children: [
  //     {
  //       key: "settings",
  //       label: "Settings",
  //       icon: Settings,
  //       href: "/admin/system/settings",
  //     },
  //     {
  //       key: "database",
  //       label: "Database",
  //       icon: Database,
  //       href: "/admin/system/database",
  //     },
  //     {
  //       key: "activity",
  //       label: "Activity Logs",
  //       icon: Activity,
  //       href: "/admin/system/activity",
  //     },
  //   ],
  // },
];

/* -------------------- Pure helpers -------------------- */
const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const itemIsActive = (pathname: string, item: NavItem): boolean => {
  if (isGroup(item)) {
    if (item.baseHref && isActiveHref(pathname, item.baseHref)) return true;
    return item.children.some((child) => itemIsActive(pathname, child));
  }
  return isActiveHref(pathname, item.href);
};

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
export default function AdminSidebar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  const [pinned, setPinned] = useState(false);
  const [toggledOpenKeys, setToggledOpenKeys] = useState<Set<string>>(
    new Set()
  );
  const [explicitlyClosedKeys, setExplicitlyClosedKeys] = useState<Set<string>>(
    new Set()
  );

  const activeOpenKeys = useMemo(
    () => computeActiveOpenKeys(navConfig, pathname),
    [pathname]
  );

  const openKeys = useMemo(() => {
    const s = new Set<string>();
    activeOpenKeys.forEach((k) => {
      if (!explicitlyClosedKeys.has(k)) {
        s.add(k);
      }
    });
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
      setExplicitlyClosedKeys((prev) => new Set(prev).add(key));
      setToggledOpenKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setExplicitlyClosedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setToggledOpenKeys((prev) => new Set(prev).add(key));
    }
  };

  const handleLogout = () => dispatch(logoutUser());

  const expandedJustifyCls = pinned
    ? "justify-start"
    : "justify-center group-hover:justify-start";

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

  const labelPositionCls = pinned ? "" : "absolute pointer-events-none";
  const chevronPositionCls = pinned ? "" : "absolute pointer-events-none";

  return (
    <aside
      className={cn(
        "group h-screen",
        pinned ? "w-64" : "w-16 hover:w-64",
        "transition-[width] duration-300 ease-out",
        "bg-primary text-white flex flex-col justify-between",
        "rounded-tr-3xl rounded-br-3xl shadow-lg overflow-hidden"
      )}
    >
      {/* Top */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 px-3 py-6 border-b border-white/10 flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
            <Shield size={18} />
          </div>

          <span
            className={cn(
              showTextCls,
              "transition-all duration-300 ease-out",
              "text-lg font-semibold tracking-wide whitespace-nowrap"
            )}
          >
            Admin Panel
          </span>

          <button
            onClick={() => setPinned((p) => !p)}
            className={cn(
              pinned ? "inline-flex" : "hidden group-hover:inline-flex",
              "ml-auto rounded-lg p-1.5 hover:bg-white/10 transition-colors",
              pinned
                ? ""
                : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
              pinned ? "bg-white/15" : ""
            )}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={pinned}
          >
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>

        <nav className="mt-4 px-2 space-y-1 overflow-y-auto flex-1 min-h-0">
          {navConfig.map((item) => (
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
  const paddingLeft = Math.min(8 + depth * 14, 40);

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

      <div
        className={cn(
          showChildrenContainerBase,
          "transition-[max-height,opacity,margin] duration-300 ease-out",
          open ? "opacity-100 mt-1" : "opacity-0 mt-0",
          "overflow-hidden ml-8 space-y-1"
        )}
        style={{ maxHeight: open ? 240 : 0 }}
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
