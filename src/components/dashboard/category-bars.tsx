import { formatVnd } from "@/lib/money";
import type { CategorySpend } from "@/lib/report";

/** Chi theo danh mục: thanh ngang xếp hạng, một màu; số tiền và % in cạnh thanh (không chỉ dựa vào màu). */
export function CategoryBars({
  rows,
  total,
}: {
  rows: CategorySpend[];
  total: bigint;
}) {
  const max = rows[0]?.amount ?? 0n;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const width = max > 0n ? Number((r.amount * 1000n) / max) / 10 : 0;
        const share = total > 0n ? Number((r.amount * 100n) / total) : 0;
        return (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 tabular-nums">
                <strong className="font-semibold">{formatVnd(r.amount)}</strong>
                <span className="text-fg-muted"> · {share}%</span>
              </span>
            </div>
            <div className="h-2.5" aria-hidden>
              <div
                className="h-full rounded-r-[4px] bg-chart-expense"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
