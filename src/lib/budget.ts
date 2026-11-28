// Tính mức dùng ngân sách (PLAN.md giai đoạn 6). Tiền là bigint, % làm tròn xuống.

export type BudgetStatus = "ok" | "warning" | "over";

export const WARNING_PERCENT = 80;

/** % đã dùng (làm tròn xuống) và trạng thái: ≥ 80% cảnh báo, vượt hạn mức là "over". */
export function budgetUsage(
  spent: bigint,
  budget: bigint,
): { percent: number; status: BudgetStatus } {
  if (budget <= 0n) throw new Error("Ngân sách phải lớn hơn 0");
  const percent = Number((spent * 100n) / budget);
  const status: BudgetStatus =
    spent > budget ? "over" : percent >= WARNING_PERCENT ? "warning" : "ok";
  return { percent, status };
}

/**
 * Tiền đã chi theo danh mục, trong đó danh mục cha gồm cả danh mục con.
 * `ownSpent`: tổng chi gắn trực tiếp với từng danh mục; `parentOf`: con → cha.
 */
export function spentWithChildren(
  ownSpent: Map<string, bigint>,
  parentOf: Map<string, string | null>,
): Map<string, bigint> {
  const total = new Map<string, bigint>();
  const add = (id: string, v: bigint) =>
    total.set(id, (total.get(id) ?? 0n) + v);
  for (const [categoryId, amount] of ownSpent) {
    add(categoryId, amount);
    const parent = parentOf.get(categoryId);
    if (parent) add(parent, amount);
  }
  return total;
}
