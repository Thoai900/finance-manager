import { ArrowRight, FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BudgetBar } from "@/components/budgets/budget-bar";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { GlassCard } from "@/components/glass/glass-card";
import { StatTile } from "@/components/glass/stat-tile";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import { formatMonth, formatVnDate } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { getDashboard } from "@/server/queries/dashboard";

const linkClass =
  "glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium";

async function DashboardContent() {
  const d = await getDashboard();

  if (!d.hasAnyTransaction) {
    return (
      <GlassCard className="flex flex-col gap-4">
        <p className="text-lg font-semibold">Chưa có giao dịch nào</p>
        <p className="text-fg-muted">
          Nhập sao kê Techcombank hoặc thêm giao dịch đầu tiên để xem tổng quan
          thu chi.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/import" className={linkClass}>
            <FileUp className="size-4" aria-hidden />
            Nhập sao kê
          </Link>
          <Link href="/transactions" className={linkClass}>
            <Plus className="size-4" aria-hidden />
            Thêm giao dịch
          </Link>
        </div>
      </GlassCard>
    );
  }

  const monthLabel = formatMonth(d.month);
  const net = d.thisMonth.income - d.thisMonth.expense;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Số liệu chính"
        className="grid grid-cols-2 gap-3 sm:gap-4"
      >
        <StatTile
          label="Tổng số dư"
          value={formatVnd(d.totalBalance)}
          hint={`${d.activeAccounts} ví`}
        />
        <StatTile
          label="Thu tháng này"
          value={formatVnd(d.thisMonth.income)}
          tone="income"
          hint={monthLabel}
        />
        <StatTile
          label="Chi tháng này"
          value={formatVnd(d.thisMonth.expense)}
          tone="expense"
          hint={monthLabel}
        />
        <StatTile
          label="Chênh lệch"
          value={`${net > 0n ? "+" : ""}${formatVnd(net)}`}
          tone={net >= 0n ? "income" : "expense"}
          hint="Thu − chi tháng này"
        />
      </section>

      <GlassCard>
        <TrendChart
          data={d.trend.map((t) => ({
            label: formatMonth(t.month),
            short: `T${Number(t.month.slice(5))}`,
            income: Number(t.income),
            expense: Number(t.expense),
            incomeText: formatVnd(t.income),
            expenseText: formatVnd(t.expense),
          }))}
        />
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-4">
          <h2 className="font-semibold">Chi theo danh mục · {monthLabel}</h2>
          {d.byCategory.length ? (
            <CategoryBars rows={d.byCategory} total={d.thisMonth.expense} />
          ) : (
            <p className="text-fg-muted">Tháng này chưa có khoản chi.</p>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Ngân sách cần chú ý</h2>
            <Link href="/budgets" className="text-sm text-fg-muted underline">
              Xem ngân sách
            </Link>
          </div>
          {d.budgetAlerts.length ? (
            <ul className="flex flex-col gap-3">
              {d.budgetAlerts.map((b) => (
                <li key={b.categoryId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{b.name}</span>
                    <span
                      className={cn(
                        "shrink-0 font-medium",
                        b.status === "over" ? "text-expense" : "text-warning",
                      )}
                    >
                      {b.status === "over"
                        ? `Vượt ${formatVnd(b.spent - b.budget!)}`
                        : `Đã dùng ${b.percent}%`}
                    </span>
                  </div>
                  <BudgetBar
                    percent={b.percent!}
                    status={b.status!}
                    label={`Ngân sách ${b.name}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted">
              Không có ngân sách nào sắp hết hoặc đã vượt.
            </p>
          )}
        </GlassCard>
      </div>

      <GlassCard strong className="p-0">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <h2 className="font-semibold">Giao dịch gần đây</h2>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm text-fg-muted underline"
          >
            Xem tất cả
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul>
          {d.recent.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between gap-4 border-t border-glass-border px-5 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {tx.type === "transfer"
                    ? "Chuyển khoản"
                    : (tx.category?.name ?? "Chưa phân loại")}
                </span>
                <span className="block truncate text-sm text-fg-muted">
                  {formatVnDate(tx.occurredAt)} · {tx.account.name}
                  {tx.toAccount ? ` → ${tx.toAccount.name}` : ""}
                  {(tx.note ?? tx.counterparty)
                    ? ` · ${tx.note ?? tx.counterparty}`
                    : ""}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  tx.type === "income" && "text-income",
                  tx.type === "expense" && "text-expense",
                )}
              >
                {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                {formatVnd(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Tổng quan" />
      <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
