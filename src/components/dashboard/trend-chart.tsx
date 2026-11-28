"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type TrendPoint = {
  /** "Tháng 11/2026" */
  label: string;
  /** "T11" — nhãn ngắn dưới cột */
  short: string;
  income: number;
  expense: number;
  /** Giá trị đã định dạng "1.250.000 đ" */
  incomeText: string;
  expenseText: string;
};

const compact = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Mốc trục tròn số: 1, 2, 2.5, 5 × 10^k, không nhỏ hơn giá trị lớn nhất. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10])
    if (step * pow >= max) return step * pow;
  return 10 * pow;
}

const SERIES = [
  { key: "income", name: "Thu", bar: "bg-chart-income" },
  { key: "expense", name: "Chi", bar: "bg-chart-expense" },
] as const;

/** Cột nhóm Thu/Chi theo tháng: một trục, chú thích, tooltip khi rê chuột/focus, và bảng số liệu. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...data.flatMap((d) => [d.income, d.expense])));
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Thu và chi 6 tháng</span>
        <span className="flex gap-4 text-sm text-fg-muted" aria-hidden>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-sm", s.bar)} />
              {s.name}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="relative flex h-48 gap-2 pt-2">
        {/* Trục dọc: 0, giữa, đỉnh — đường lưới mảnh, chìm */}
        <div
          className="relative w-12 shrink-0 text-right text-xs text-fg-muted tabular-nums"
          aria-hidden
        >
          {[1, 0.5, 0].map((f) => (
            <span
              key={f}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(1 - f) * 100}%` }}
            >
              {compact.format(top * f)}
            </span>
          ))}
        </div>
        <div
          className="relative flex flex-1 items-end justify-around"
          onMouseLeave={() => setActive(null)}
        >
          {[1, 0.5, 0].map((f) => (
            <div
              key={f}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-fg/10"
              style={{ top: `${(1 - f) * 100}%` }}
            />
          ))}
          {data.map((d, i) => (
            <button
              key={d.label}
              type="button"
              aria-label={`${d.label}: thu ${d.incomeText}, chi ${d.expenseText}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-lg focus-visible:outline-none",
                active === i && "bg-fg/5",
              )}
            >
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px]",
                    s.bar,
                    active === i && "brightness-110",
                  )}
                  style={{ height: pct(d[s.key]) }}
                />
              ))}
              {active === i ? (
                <span
                  role="tooltip"
                  className="glass-strong absolute bottom-full z-10 mb-2 flex min-w-max flex-col gap-1 rounded-lg px-3 py-2 text-left text-sm"
                >
                  <span className="text-fg-muted">{d.label}</span>
                  {SERIES.map((s) => (
                    <span key={s.key} className="flex items-center gap-2">
                      <span
                        className={cn("h-0.5 w-3 rounded-full", s.bar)}
                        aria-hidden
                      />
                      <strong className="tabular-nums">
                        {s.key === "income" ? d.incomeText : d.expenseText}
                      </strong>
                      <span className="text-fg-muted">{s.name}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pl-14 text-xs text-fg-muted" aria-hidden>
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center">
            {d.short}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-fg-muted">
          Xem dạng bảng
        </summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left text-fg-muted">
              <th className="py-1 font-normal">Tháng</th>
              <th className="py-1 text-right font-normal">Thu</th>
              <th className="py-1 text-right font-normal">Chi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-glass-border">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{d.incomeText}</td>
                <td className="py-1 text-right">{d.expenseText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
