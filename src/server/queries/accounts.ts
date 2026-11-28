import { connection } from "next/server";
import { db } from "@/lib/db";

export async function listAccounts() {
  await connection(); // dữ liệu luôn mới, không prerender lúc build
  return db.account.findMany({
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
  });
}
