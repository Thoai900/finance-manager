import { GlassCard } from "@/components/glass/glass-card";

export default function BudgetsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Ngân sách</h1>
      <GlassCard>
        <p className="text-fg-muted">
          Sẽ có ở Giai đoạn 6: ngân sách theo tháng.
        </p>
      </GlassCard>
    </>
  );
}
