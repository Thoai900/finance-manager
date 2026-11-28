"use client";

import {
  ArrowLeftRight,
  FileUp,
  LayoutDashboard,
  PiggyBank,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/transactions", label: "Giao dịch", icon: ArrowLeftRight },
  { href: "/import", label: "Nhập sao kê", icon: FileUp },
  { href: "/budgets", label: "Ngân sách", icon: PiggyBank },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

function NavLinks({
  layout,
  pathname,
}: {
  layout: "sidebar" | "bottom";
  pathname?: string;
}) {
  return NAV_ITEMS.map(({ href, label, icon: Icon }) => {
    const active = pathname?.startsWith(href) ?? false;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center rounded-xl transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
          layout === "sidebar"
            ? "gap-3 px-3 py-2.5 text-sm"
            : "flex-1 flex-col gap-1 py-2 text-[11px] leading-none",
          active
            ? "bg-accent text-accent-fg"
            : "text-fg-muted hover:bg-white/10 hover:text-fg",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span>{label}</span>
      </Link>
    );
  });
}

function ActiveNavLinks({ layout }: { layout: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  return <NavLinks layout={layout} pathname={pathname} />;
}

function Links({ layout }: { layout: "sidebar" | "bottom" }) {
  // Suspense: với cacheComponents, usePathname có thể phải chờ ở route động.
  return (
    <Suspense fallback={<NavLinks layout={layout} />}>
      <ActiveNavLinks layout={layout} />
    </Suspense>
  );
}

export function Sidebar() {
  return (
    <aside className="glass fixed inset-y-4 left-4 hidden w-60 flex-col rounded-2xl p-4 md:flex">
      <p className="px-3 pb-4 text-lg font-semibold">Tài chính</p>
      <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
        <Links layout="sidebar" />
      </nav>
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="glass fixed inset-x-2 bottom-2 z-30 flex gap-1 rounded-2xl p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <Links layout="bottom" />
    </nav>
  );
}
