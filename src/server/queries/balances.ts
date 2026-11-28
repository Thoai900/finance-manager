import { connection } from "next/server";
import { computeBalances } from "@/lib/balance";
import { db } from "@/lib/db";

/** Số dư hiện tại của mọi ví (kể cả ví đã lưu trữ). */
export async function getAccountBalances(): Promise<Map<string, bigint>> {
  await connection();
  const [accounts, outgoing, incoming] = await Promise.all([
    db.account.findMany({ select: { id: true, initialBalance: true } }),
    db.transaction.groupBy({
      by: ["accountId", "type"],
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["toAccountId"],
      where: { type: "transfer", toAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  return computeBalances(
    accounts,
    outgoing.map((r) => ({
      accountId: r.accountId,
      type: r.type,
      total: r._sum.amount ?? 0n,
    })),
    incoming.map((r) => ({
      toAccountId: r.toAccountId!,
      total: r._sum.amount ?? 0n,
    })),
  );
}
