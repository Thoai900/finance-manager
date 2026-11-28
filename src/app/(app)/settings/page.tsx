import { GlassCard } from "@/components/glass/glass-card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Cài đặt</h1>
      <GlassCard className="flex flex-col gap-3">
        <p className="text-fg-muted">Giao diện</p>
        <div>
          <ThemeToggle />
        </div>
      </GlassCard>
    </>
  );
}
