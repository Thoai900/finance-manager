import { GlassCard } from "@/components/glass/glass-card";

export default function DashboardPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Tổng quan</h1>
      <GlassCard>
        <p className="text-fg-muted">
          Sẽ có ở Giai đoạn 7: tổng số dư, thu chi tháng, biểu đồ.
        </p>
      </GlassCard>
    </>
  );
}
