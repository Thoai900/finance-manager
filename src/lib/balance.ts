// Số dư ví được tính từ giao dịch, không lưu riêng (PLAN.md mục 3):
// số dư = số dư ban đầu + thu − chi + chuyển vào − chuyển ra.

export type TransactionKind = "income" | "expense" | "transfer";

/** Tổng tiền theo (ví nguồn, loại giao dịch). */
export type OutgoingSum = {
  accountId: string;
  type: TransactionKind;
  total: bigint;
};
/** Tổng tiền chuyển vào theo ví đích. */
export type IncomingSum = { toAccountId: string; total: bigint };

export function computeBalances(
  accounts: { id: string; initialBalance: bigint }[],
  outgoing: OutgoingSum[],
  incoming: IncomingSum[],
): Map<string, bigint> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalance]));
  const add = (id: string, delta: bigint) => {
    if (balances.has(id)) balances.set(id, balances.get(id)! + delta);
  };
  for (const row of outgoing) {
    add(row.accountId, row.type === "income" ? row.total : -row.total);
  }
  for (const row of incoming) add(row.toAccountId, row.total);
  return balances;
}
