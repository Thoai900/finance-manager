import { connection } from "next/server";
import { db } from "@/lib/db";

export async function listImportBatches() {
  await connection();
  return db.importBatch.findMany({
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
