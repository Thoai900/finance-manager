import "dotenv/config";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import {
  copyBudgetsFromPreviousMonth,
  setBudget,
} from "@/server/actions/budgets";
import { loadBudgetOverview } from "@/server/queries/budgets";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => ({ email: "owner@test" }),
}));

// Tháng riêng để không lẫn giao dịch của các file test khác.
const MONTH = "2031-10";
const P = "__test_budget__";
let food: string;
let coffee: string;
let travel: string;
let excluded: string;
let salary: string;
let account: string;

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const spend = (
  categoryId: string | null,
  amount: bigint,
  iso: string,
  type: "expense" | "income" | "transfer" = "expense",
) =>
  db.transaction.create({
    data: {
      type,
      amount,
      accountId: account,
      categoryId,
      occurredAt: new Date(iso),
      note: P,
    },
  });
const rowOf = async (id: string, month = MONTH) =>
  (await loadBudgetOverview(month)).rows.find((r) => r.categoryId === id)!;

beforeEach(async () => {
  account = (
    await db.account.create({ data: { name: P + "acc", type: "cash" } })
  ).id;
  const cat = (name: string, extra: object = {}) =>
    db.category
      .create({ data: { name: P + name, kind: "expense", ...extra } })
      .then((c) => c.id);
  food = await cat("Food");
  coffee = await cat("Coffee", { parentId: food });
  travel = await cat("Travel");
  excluded = await cat("Moved", { excludeFromReports: true });
  salary = await db.category
    .create({ data: { name: P + "Salary", kind: "income" } })
    .then((c) => c.id);
});
afterEach(async () => {
  await db.transaction.deleteMany({ where: { note: P } });
  await db.account.deleteMany({ where: { name: { startsWith: P } } });
  await db.budget.deleteMany({
    where: { category: { name: { startsWith: P } } },
  });
  await db.category.deleteMany({
    where: { name: { startsWith: P }, parentId: { not: null } },
  });
  await db.category.deleteMany({ where: { name: { startsWith: P } } });
});
afterAll(() => db.$disconnect());

describe("tính ngân sách tháng", () => {
  test("cha gồm con; tính theo giờ VN; bỏ thu, chuyển khoản, danh mục không tính thống kê", async () => {
    await setBudget(
      form({ categoryId: food, month: MONTH, amount: "1.000.000" }),
    );
    await setBudget(
      form({ categoryId: coffee, month: MONTH, amount: "200.000" }),
    );
    await spend(food, 500000n, "2031-10-05T05:00:00Z");
    await spend(coffee, 150000n, "2031-10-31T16:30:00Z"); // 23:30 ngày 31/10 giờ VN → tháng 10
    await spend(coffee, 999000n, "2031-10-31T17:30:00Z"); // 00:30 ngày 1/11 giờ VN → tháng 11
    await spend(coffee, 70000n, "2031-09-30T17:00:00Z"); // 00:00 ngày 1/10 giờ VN → tháng 10
    await spend(salary, 9000000n, "2031-10-10T05:00:00Z", "income");
    await spend(null, 300000n, "2031-10-10T05:00:00Z", "transfer");
    await spend(excluded, 400000n, "2031-10-10T05:00:00Z");

    const coffeeRow = await rowOf(coffee);
    expect(coffeeRow).toMatchObject({
      spent: 220000n,
      budget: 200000n,
      percent: 110,
      status: "over",
      parentId: food,
    });
    const foodRow = await rowOf(food);
    expect(foodRow).toMatchObject({
      spent: 720000n,
      budget: 1000000n,
      percent: 72,
      status: "ok",
    });
    expect((await rowOf(coffee, "2031-11")).spent).toBe(999000n);

    const o = await loadBudgetOverview(MONTH);
    expect(
      o.rows.some((r) => r.categoryId === excluded || r.categoryId === salary),
    ).toBe(false);
    // Không tính trùng ngân sách con khi cha cũng có ngân sách.
    const mine = o.rows.filter((r) => r.name.startsWith(P) && r.budget);
    expect(mine.map((r) => r.categoryId).sort()).toEqual([coffee, food].sort());
    expect(o.totalBudget).toBeGreaterThanOrEqual(1000000n);
  });

  test("cảnh báo từ 80%", async () => {
    await setBudget(
      form({ categoryId: travel, month: MONTH, amount: "100000" }),
    );
    await spend(travel, 80000n, "2031-10-15T05:00:00Z");
    expect(await rowOf(travel)).toMatchObject({
      percent: 80,
      status: "warning",
    });
  });
});

describe("đặt, bỏ, chép ngân sách", () => {
  test("đặt rồi sửa; để trống thì bỏ ngân sách", async () => {
    expect(
      await setBudget(
        form({ categoryId: travel, month: MONTH, amount: "300.000" }),
      ),
    ).toEqual({ ok: true });
    await setBudget(
      form({ categoryId: travel, month: MONTH, amount: "350000" }),
    );
    expect((await rowOf(travel)).budget).toBe(350000n);
    await setBudget(form({ categoryId: travel, month: MONTH, amount: "" }));
    expect((await rowOf(travel)).budget).toBeNull();
  });

  test.each([
    [
      () => ({ categoryId: travel, month: "2031-13", amount: "1" }),
      "Tháng không hợp lệ",
    ],
    [
      () => ({ categoryId: travel, month: MONTH, amount: "1,5" }),
      "Số tiền không hợp lệ",
    ],
    [
      () => ({ categoryId: travel, month: MONTH, amount: "-5000" }),
      "Số tiền không hợp lệ",
    ],
    [
      () => ({ categoryId: salary, month: MONTH, amount: "1" }),
      "Chỉ đặt ngân sách cho danh mục chi",
    ],
    [
      () => ({ categoryId: excluded, month: MONTH, amount: "1" }),
      "không tính vào thống kê",
    ],
  ])("từ chối dữ liệu sai %#", async (values, message) => {
    const r = await setBudget(form(values()));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });

  test("chép từ tháng trước, giữ ngân sách đã đặt ở tháng này", async () => {
    await setBudget(
      form({ categoryId: food, month: "2031-09", amount: "1000000" }),
    );
    await setBudget(
      form({ categoryId: travel, month: "2031-09", amount: "500000" }),
    );
    await setBudget(
      form({ categoryId: travel, month: MONTH, amount: "600000" }),
    );
    expect((await loadBudgetOverview(MONTH)).previousMonthHasBudgets).toBe(
      true,
    );
    expect(await copyBudgetsFromPreviousMonth(MONTH)).toEqual({ ok: true });
    expect((await rowOf(food)).budget).toBe(1000000n);
    expect((await rowOf(travel)).budget).toBe(600000n);
    expect(await copyBudgetsFromPreviousMonth("2031-01")).toMatchObject({
      ok: false,
    });
  });
});
