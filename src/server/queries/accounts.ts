import { db } from "@/lib/db";
import { requireOwner } from "@/server/auth-guard";

export async function listAccounts() {
  await requireOwner();
  return db.account.findMany({
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
  });
}
