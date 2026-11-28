import { db } from "@/lib/db";
import { requireOwner } from "@/server/auth-guard";

export async function listImportBatches() {
  await requireOwner();
  return db.importBatch.findMany({
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
