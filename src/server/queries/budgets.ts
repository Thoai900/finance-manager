import {
  type BudgetStatus,
  budgetUsage,
  spentWithChildren,
} from "@/lib/budget";
import { shiftMonth, vnMonthRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireOwner } from "@/server/auth-guard";

export type BudgetRow = {
  categoryId: string;
  name: string;
  parentId: string | null;
  budget: bigint | null;
  /** Đã chi trong tháng; danh mục cha gồm cả danh mục con. */
  spent: bigint;
  percent: number | null;
  status: BudgetStatus | null;
};

export type BudgetOverview = {
  month: string;
  rows: BudgetRow[];
  /** Tổng ngân sách, không tính trùng khi cả danh mục cha và con cùng có ngân sách. */
  totalBudget: bigint;
  /** Đã chi trong phạm vi các ngân sách đó. */
  totalBudgetedSpent: bigint;
  /** Tổng chi cả tháng (trừ danh mục "không tính vào thống kê" và chuyển khoản). */
  totalExpense: bigint;
  previousMonthHasBudgets: boolean;
};

/** Không kiểm tra đăng nhập — dùng trong test và trong hàm đã kiểm tra. */
export async function loadBudgetOverview(
  month: string,
): Promise<BudgetOverview> {
  const range = vnMonthRange(month);
  const [categories, budgets, spentRows, uncategorized, previousCount] =
    await Promise.all([
      db.category.findMany({
        where: { kind: "expense", excludeFromReports: false },
      }),
      db.budget.findMany({ where: { month } }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: {
          type: "expense",
          occurredAt: range,
          categoryId: { not: null },
        },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { type: "expense", occurredAt: range, categoryId: null },
        _sum: { amount: true },
      }),
      db.budget.count({ where: { month: shiftMonth(month, -1) } }),
    ]);

  const included = new Set(categories.map((c) => c.id));
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const own = new Map<string, bigint>();
  for (const r of spentRows) {
    if (r.categoryId && included.has(r.categoryId))
      own.set(r.categoryId, r._sum.amount ?? 0n);
  }
  const spent = spentWithChildren(own, parentOf);
  const budgetOf = new Map(
    budgets
      .filter((b) => included.has(b.categoryId))
      .map((b) => [b.categoryId, b.amount]),
  );

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "vi");
  const roots = categories
    .filter((c) => !c.parentId || !included.has(c.parentId))
    .sort(byName);
  const rows: BudgetRow[] = [];
  const toRow = (c: (typeof categories)[number]): BudgetRow => {
    const budget = budgetOf.get(c.id) ?? null;
    const s = spent.get(c.id) ?? 0n;
    const usage = budget ? budgetUsage(s, budget) : null;
    return {
      categoryId: c.id,
      name: c.name,
      parentId: c.parentId && included.has(c.parentId) ? c.parentId : null,
      budget,
      spent: s,
      percent: usage?.percent ?? null,
      status: usage?.status ?? null,
    };
  };
  for (const root of roots) {
    rows.push(toRow(root));
    for (const child of categories
      .filter((c) => c.parentId === root.id)
      .sort(byName))
      rows.push(toRow(child));
  }

  // Ngân sách "trên cùng": danh mục có ngân sách mà danh mục cha không có.
  const top = rows.filter(
    (r) => r.budget && !(r.parentId && budgetOf.has(r.parentId)),
  );
  return {
    month,
    rows,
    totalBudget: top.reduce((sum, r) => sum + r.budget!, 0n),
    totalBudgetedSpent: top.reduce((sum, r) => sum + r.spent, 0n),
    totalExpense:
      [...own.values()].reduce((a, b) => a + b, 0n) +
      (uncategorized._sum.amount ?? 0n),
    previousMonthHasBudgets: previousCount > 0,
  };
}

export async function getBudgetOverview(
  month: string,
): Promise<BudgetOverview> {
  await requireOwner();
  return loadBudgetOverview(month);
}
