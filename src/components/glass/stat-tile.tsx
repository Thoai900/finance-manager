import { cn } from "@/lib/cn";
import { GlassCard } from "./glass-card";

type StatTileProps = {
  label: string;
  /** Giá trị đã định dạng sẵn, ví dụ "1.250.000 ₫". */
  value: string;
  tone?: "neutral" | "income" | "expense";
  hint?: string;
};

export function StatTile({
  label,
  value,
  tone = "neutral",
  hint,
}: StatTileProps) {
  return (
    <GlassCard>
      <p className="text-sm text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-lg font-semibold whitespace-nowrap sm:text-2xl",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </GlassCard>
  );
}
