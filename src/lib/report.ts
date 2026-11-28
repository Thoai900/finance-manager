// Tổng hợp thu/chi cho trang Tổng quan (PLAN.md giai đoạn 7).
// Quy tắc chung: chuyển khoản không phải thu/chi; danh mục "không tính vào thống kê" bị bỏ qua.

import { toVnIsoDate } from "./dates";

export type ReportTx = {
  type: "income" | "expense" | "transfer";
  amount: bigint;
  occurredAt: Date;
  category: {
    id: string;
    name: string;
    parentId: string | null;
    excludeFromReports: boolean;
  } | null;
};

/** Giao dịch có được tính vào thống kê thu/chi không. */
export function countsInReports(
  tx: Pick<ReportTx, "type" | "category">,
): boolean {
  return tx.type !== "transfer" && !tx.category?.excludeFromReports;
}

export type MonthTotals = { month: string; income: bigint; expense: bigint };

/** Tổng thu/chi theo từng tháng (giờ VN), đủ mọi tháng trong `months` kể cả tháng trống. */
export function totalsByMonth(
  txs: ReportTx[],
  months: string[],
): MonthTotals[] {
  const map = new Map(
    months.map((m) => [m, { month: m, income: 0n, expense: 0n }]),
  );
  for (const tx of txs) {
    if (!countsInReports(tx)) continue;
    const row = map.get(toVnIsoDate(tx.occurredAt).slice(0, 7));
    if (!row) continue;
    if (tx.type === "income") row.income += tx.amount;
    else row.expense += tx.amount;
  }
  return months.map((m) => map.get(m)!);
}

export type CategorySpend = { id: string; name: string; amount: bigint };

export const UNCATEGORIZED_ID = "none";

/**
 * Chi theo danh mục gốc (danh mục con gộp vào cha), lớn nhất trước.
 * Quá `limit` dòng thì gộp phần đuôi thành "Khác".
 */
export function expenseByCategory(
  txs: ReportTx[],
  rootNames: Map<string, string>,
  limit = 6,
): CategorySpend[] {
  const sums = new Map<string, bigint>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !countsInReports(tx)) continue;
    const id = tx.category
      ? (tx.category.parentId ?? tx.category.id)
      : UNCATEGORIZED_ID;
    sums.set(id, (sums.get(id) ?? 0n) + tx.amount);
  }
  const rows = [...sums]
    .map(([id, amount]) => ({
      id,
      name:
        id === UNCATEGORIZED_ID ? "Chưa phân loại" : (rootNames.get(id) ?? "?"),
      amount,
    }))
    .sort((a, b) =>
      b.amount > a.amount
        ? 1
        : b.amount < a.amount
          ? -1
          : a.name.localeCompare(b.name, "vi"),
    );
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1).reduce((s, r) => s + r.amount, 0n);
  return [...head, { id: "other", name: "Khác", amount: rest }];
}
