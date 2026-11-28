import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BudgetBar } from "@/components/budgets/budget-bar";
import {
  BudgetDialog,
  CopyBudgetsButton,
} from "@/components/budgets/budget-dialog";
import { GlassCard } from "@/components/glass/glass-card";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import {
  currentVnMonth,
  formatMonth,
  isValidMonth,
  shiftMonth,
} from "@/lib/dates";
import { formatVnd, formatVndPlain } from "@/lib/money";
import { type BudgetRow, getBudgetOverview } from "@/server/queries/budgets";

function StatusText({ row }: { row: BudgetRow }) {
  if (!row.budget || !row.status) return <span>Chưa đặt ngân sách</span>;
  if (row.status === "over") {
    return (
      <span className="font-medium text-expense">
        Vượt {formatVnd(row.spent - row.budget)}
      </span>
    );
  }
  if (row.status === "warning") {
    return (
      <span className="font-medium text-warning">
        Sắp hết · còn {formatVnd(row.budget - row.spent)}
      </span>
    );
  }
  return <span>Còn {formatVnd(row.budget - row.spent)}</span>;
}

async function BudgetContent({
  searchParams,
}: {
  searchParams: PageProps<"/budgets">["searchParams"];
}) {
  const requested = (await searchParams).month;
  await connection(); // "tháng này" phụ thuộc thời điểm request, không prerender
  const current = currentVnMonth();
  const month =
    typeof requested === "string" && isValidMonth(requested)
      ? requested
      : current;
  const o = await getBudgetOverview(month);
  const monthLabel = formatMonth(month);
  const remaining = o.totalBudget - o.totalBudgetedSpent;

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Chọn tháng"
        className="flex items-center justify-between gap-2"
      >
        <Link
          href={`/budgets?month=${shiftMonth(month, -1)}`}
          className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {formatMonth(shiftMonth(month, -1))}
        </Link>
        <span className="text-center font-semibold">
          {monthLabel}
          {month !== current ? (
            <Link
              href="/budgets"
              className="ml-2 text-sm font-normal text-fg-muted underline"
            >
              Tháng này
            </Link>
          ) : null}
        </span>
        <Link
          href={`/budgets?month=${shiftMonth(month, 1)}`}
          className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm"
        >
          {formatMonth(shiftMonth(month, 1))}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>

      <GlassCard className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-fg-muted">Tổng ngân sách</p>
            <p className="font-semibold tabular-nums">
              {formatVnd(o.totalBudget)}
            </p>
          </div>
          <div>
            <p className="text-sm text-fg-muted">Đã chi trong ngân sách</p>
            <p className="font-semibold tabular-nums">
              {formatVnd(o.totalBudgetedSpent)}
            </p>
          </div>
          <div>
            <p className="text-sm text-fg-muted">
              {remaining < 0n ? "Vượt" : "Còn lại"}
            </p>
            <p
              className={cn(
                "font-semibold tabular-nums",
                remaining < 0n && "text-expense",
              )}
            >
              {formatVnd(remaining < 0n ? -remaining : remaining)}
            </p>
          </div>
          <div>
            <p className="text-sm text-fg-muted">Tổng chi cả tháng</p>
            <p className="font-semibold tabular-nums">
              {formatVnd(o.totalExpense)}
            </p>
          </div>
        </div>
        {o.totalBudget === 0n ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              Tháng này chưa có ngân sách. Bấm “Đặt” ở từng danh mục bên dưới.
            </p>
            {o.previousMonthHasBudgets ? (
              <CopyBudgetsButton month={month} />
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <GlassCard strong className="p-0">
        <ul>
          {o.rows.map((row, i) => (
            <li
              key={row.categoryId}
              className={cn(
                "flex flex-col gap-2 py-3 pr-5",
                row.parentId ? "pl-10" : "pl-5",
                i > 0 && "border-t border-glass-border",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={row.parentId ? "text-sm" : "font-medium"}>
                    {row.name}
                  </p>
                  <p className="text-sm text-fg-muted tabular-nums">
                    Đã chi {formatVnd(row.spent)}
                    {row.budget
                      ? ` / ${formatVnd(row.budget)} · ${row.percent}%`
                      : ""}
                  </p>
                </div>
                <BudgetDialog
                  categoryId={row.categoryId}
                  categoryName={row.name}
                  month={month}
                  monthLabel={monthLabel}
                  amount={row.budget ? formatVndPlain(row.budget) : null}
                />
              </div>
              {row.budget && row.status ? (
                <BudgetBar
                  percent={row.percent!}
                  status={row.status}
                  label={`Ngân sách ${row.name}`}
                />
              ) : null}
              <p className="text-sm text-fg-muted">
                <StatusText row={row} />
              </p>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <>
      <PageHeader title="Ngân sách" />
      <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
        <BudgetContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
