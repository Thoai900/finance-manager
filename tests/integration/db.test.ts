import "dotenv/config";
import { afterAll, expect, test } from "vitest";
import { db } from "@/lib/db";

afterAll(() => db.$disconnect());

test("kết nối được database và các bảng đã được migrate", async () => {
  const tables = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name`;
  expect(tables.map((t) => t.table_name)).toEqual([
    "accounts",
    "budgets",
    "categories",
    "category_rules",
    "import_batches",
    "transactions",
  ]);
  expect(await db.account.count()).toBeGreaterThanOrEqual(0);
});
