import { ChevronRight, Tags, Wallet, Wand2 } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/glass/glass-card";
import { LogoutButton } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  {
    href: "/settings/accounts",
    label: "Ví",
    hint: "Tài khoản ngân hàng, tiền mặt, ví điện tử",
    icon: Wallet,
  },
  {
    href: "/settings/categories",
    label: "Danh mục",
    hint: "Danh mục thu chi",
    icon: Tags,
  },
  {
    href: "/settings/rules",
    label: "Quy tắc phân loại",
    hint: "Tự xếp giao dịch sao kê vào danh mục",
    icon: Wand2,
  },
] as const;

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Cài đặt</h1>
      <div className="flex flex-col gap-4">
        <GlassCard className="p-0">
          <ul>
            {LINKS.map(({ href, label, hint, icon: Icon }, i) => (
              <li
                key={href}
                className={i > 0 ? "border-t border-glass-border" : undefined}
              >
                <Link
                  href={href}
                  className="flex items-center gap-4 rounded-2xl px-5 py-4 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <Icon className="size-5 text-fg-muted" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="text-sm text-fg-muted">{hint}</span>
                  </span>
                  <ChevronRight className="size-5 text-fg-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="flex flex-col gap-3">
          <p className="text-fg-muted">Giao diện</p>
          <div>
            <ThemeToggle />
          </div>
        </GlassCard>
        <GlassCard className="flex flex-col gap-3">
          <p className="text-fg-muted">Tài khoản</p>
          <div>
            <LogoutButton />
          </div>
        </GlassCard>
      </div>
    </>
  );
}
