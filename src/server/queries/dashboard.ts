import { currentVnMonth, shiftMonth, vnMonthRange } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  type CategorySpend,
  expenseByCategory,
  type MonthTotals,
  totalsByMonth,
} from "@/lib/report";
import { requireOwner } from "@/server/auth-guard";
import { loadBalances } from "./balances";
import { type BudgetRow, loadBudgetOverview } from "./budgets";

export const TREND_MONTHS = 6;

export type Dashboard = {
  month: string;
  totalBalance: bigint;
  activeAccounts: number;
  thisMonth: MonthTotals;
  trend: MonthTotals[];
  byCategory: CategorySpend[];
  budgetAlerts: BudgetRow[];
  recent: Awaited<ReturnType<typeof loadRecent>>;
  hasAnyTransaction: boolean;
};

function loadRecent() {
  return db.transaction.findMany({
    include: {
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

/** Không kiểm tra đăng nhập — dùng trong test và trong hàm đã kiểm tra. */
export async function loadDashboard(now = new Date()): Promise<Dashboard> {
  const month = currentVnMonth(now);
  const months = Array.from({ length: TREND_MONTHS }, (_, i) =>
    shiftMonth(month, i - (TREND_MONTHS - 1)),
  );
  const range = {
    gte: vnMonthRange(months[0]).gte,
    lt: vnMonthRange(month).lt,
  };

  const [accounts, balances, txs, roots, budgets, recent, anyTx] =
    await Promise.all([
      db.account.findMany({ where: { archived: false }, select: { id: true } }),
      loadBalances(),
      db.transaction.findMany({
        where: { occurredAt: range, type: { in: ["income", "expense"] } },
        select: {
          type: true,
          amount: true,
          occurredAt: true,
          category: {
            select: {
              id: true,
              name: true,
              parentId: true,
              excludeFromReports: true,
            },
          },
        },
      }),
      db.category.findMany({
        where: { parentId: null },
        select: { id: true, name: true },
      }),
      loadBudgetOverview(month),
      loadRecent(),
      db.transaction.findFirst({ select: { id: true } }),
    ]);

  const trend = totalsByMonth(txs, months);
  const thisRange = vnMonthRange(month);
  const thisMonthTxs = txs.filter(
    (t) => t.occurredAt >= thisRange.gte && t.occurredAt < thisRange.lt,
  );
  return {
    month,
    totalBalance: accounts.reduce(
      (sum, a) => sum + (balances.get(a.id) ?? 0n),
      0n,
    ),
    activeAccounts: accounts.length,
    thisMonth: trend[trend.length - 1],
    trend,
    byCategory: expenseByCategory(
      thisMonthTxs,
      new Map(roots.map((c) => [c.id, c.name])),
    ),
    budgetAlerts: budgets.rows
      .filter((r) => r.status === "warning" || r.status === "over")
      .sort((a, b) => b.percent! - a.percent!),
    recent,
    hasAnyTransaction: anyTx !== null,
  };
}

export async function getDashboard(): Promise<Dashboard> {
  await requireOwner();
  return loadDashboard();
}
