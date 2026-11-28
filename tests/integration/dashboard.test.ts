import "dotenv/config";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import { loadDashboard } from "@/server/queries/dashboard";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => ({ email: "owner@test" }),
}));

// Mốc thời gian riêng (tháng 3/2032) để không lẫn dữ liệu của các file test khác.
const NOW = new Date("2032-03-20T05:00:00Z");
const P = "__test_dash__";
let bank: string;
let cash: string;

const add = (
  type: "income" | "expense" | "transfer",
  amount: number,
  iso: string,
  categoryId: string | null,
  extra = {},
) =>
  db.transaction.create({
    data: {
      type,
      amount: BigInt(amount),
      accountId: bank,
      categoryId,
      occurredAt: new Date(iso),
      note: P,
      ...extra,
    },
  });

beforeEach(async () => {
  bank = (await db.account.create({ data: { name: P + "bank", type: "bank" } }))
    .id;
  cash = (await db.account.create({ data: { name: P + "cash", type: "cash" } }))
    .id;
  await db.category.create({
    data: {
      id: "dash_cafe",
      name: P + "Cafe",
      kind: "expense",
      parentId: "cat_an_uong",
    },
  });
  await db.budget.create({
    data: { categoryId: "cat_di_lai", month: "2032-03", amount: 100000n },
  });

  await add("income", 15000000, "2032-03-05T03:00:00Z", "cat_luong");
  await add("expense", 300000, "2032-03-06T03:00:00Z", "cat_an_uong");
  await add("expense", 45000, "2032-03-07T03:00:00Z", "dash_cafe");
  await add("expense", 90000, "2032-03-08T03:00:00Z", "cat_di_lai");
  await add("expense", 1000000, "2032-03-09T03:00:00Z", "cat_chuyen_tk_khac"); // không tính thống kê
  await add("transfer", 2000000, "2032-03-10T03:00:00Z", null, {
    toAccountId: cash,
  }); // không phải thu/chi
  await add("expense", 70000, "2032-03-11T03:00:00Z", null); // chưa phân loại
  await add("expense", 500000, "2032-02-29T16:30:00Z", "cat_mua_sam"); // 23:30 29/2 VN → tháng 2
  await add("income", 84, "2031-10-15T03:00:00Z", "cat_tien_lai");
  await add("expense", 777, "2031-09-30T03:00:00Z", "cat_mua_sam"); // ngoài 6 tháng
});
afterEach(async () => {
  await db.transaction.deleteMany({ where: { note: P } });
  await db.budget.deleteMany({ where: { month: "2032-03" } });
  await db.category.deleteMany({ where: { id: "dash_cafe" } });
  await db.account.deleteMany({ where: { name: { startsWith: P } } });
});
afterAll(() => db.$disconnect());

test("số liệu tổng quan khớp tính tay", async () => {
  const d = await loadDashboard(NOW);
  expect(d.month).toBe("2032-03");
  expect(d.thisMonth).toEqual({
    month: "2032-03",
    income: 15000000n,
    expense: 300000n + 45000n + 90000n + 70000n,
  });
  expect(d.trend.map((t) => [t.month, t.income, t.expense])).toEqual([
    ["2031-10", 84n, 0n],
    ["2031-11", 0n, 0n],
    ["2031-12", 0n, 0n],
    ["2032-01", 0n, 0n],
    ["2032-02", 0n, 500000n],
    ["2032-03", 15000000n, 505000n],
  ]);
  expect(d.byCategory.map((c) => [c.name, c.amount])).toEqual([
    ["Ăn uống", 345000n],
    ["Đi lại", 90000n],
    ["Chưa phân loại", 70000n],
  ]);
  expect(
    d.budgetAlerts.map((b) => [b.categoryId, b.percent, b.status]),
  ).toEqual([["cat_di_lai", 90, "warning"]]);
  expect(d.recent.length).toBeGreaterThan(0);
  expect(d.hasAnyTransaction).toBe(true);
});
