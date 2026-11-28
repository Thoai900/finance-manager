import { computeBalances } from "@/lib/balance";
import { db } from "@/lib/db";
import { requireOwner } from "@/server/auth-guard";

type Client = Pick<typeof db, "account" | "transaction">;

/** Tính số dư; `accountId` để giới hạn một ví. Dùng được trong Server Action và transaction DB. */
export async function loadBalances(
  accountId?: string,
  client: Client = db,
): Promise<Map<string, bigint>> {
  const [accounts, outgoing, incoming] = await Promise.all([
    client.account.findMany({
      where: accountId ? { id: accountId } : undefined,
      select: { id: true, initialBalance: true },
    }),
    client.transaction.groupBy({
      by: ["accountId", "type"],
      where: accountId ? { accountId } : undefined,
      _sum: { amount: true },
    }),
    client.transaction.groupBy({
      by: ["toAccountId"],
      where: { type: "transfer", toAccountId: accountId ?? { not: null } },
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

/** Số dư hiện tại của mọi ví (kể cả ví đã lưu trữ), cho trang hiển thị. */
export async function getAccountBalances(): Promise<Map<string, bigint>> {
  await requireOwner();
  return loadBalances();
}
