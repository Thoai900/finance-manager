import type { BudgetStatus } from "@/lib/budget";
import { cn } from "@/lib/cn";

const COLORS: Record<BudgetStatus, string> = {
  ok: "bg-income",
  warning: "bg-warning",
  over: "bg-expense",
};

/** Thanh tiến độ ngân sách; màu kèm chữ ở nơi dùng để không chỉ dựa vào màu. */
export function BudgetBar({
  percent,
  status,
  label,
}: {
  percent: number;
  status: BudgetStatus;
  label: string;
}) {
  const width = Math.min(percent, 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={`${percent}%`}
      className="h-2 w-full overflow-hidden rounded-full bg-fg/10"
    >
      <div
        className={cn("h-full rounded-full", COLORS[status])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
