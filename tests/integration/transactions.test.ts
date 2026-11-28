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
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/actions/transactions";
import { getAccountBalances } from "@/server/queries/balances";
import {
  listTransactions,
  parseTxFilters,
} from "@/server/queries/transactions";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => ({ email: "owner@test" }),
}));

const P = "__test_tx__";
let bank: string;
let cash: string;
let archived: string;
let food: string;
let coffee: string;
let salary: string;

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const balance = async (id: string) => (await getAccountBalances()).get(id);
const txOf = (note: string) =>
  db.transaction.findFirstOrThrow({ where: { note: P + note } });

beforeEach(async () => {
  const mk = (name: string, initialBalance: bigint, archivedFlag = false) =>
    db.account.create({
      data: {
        name: P + name,
        type: "bank",
        initialBalance,
        archived: archivedFlag,
      },
    });
  bank = (await mk("Bank", 1_000_000n)).id;
  cash = (await mk("Cash", 0n)).id;
  archived = (await mk("Old", 0n, true)).id;
  food = (
    await db.category.create({ data: { name: P + "Food", kind: "expense" } })
  ).id;
  coffee = (
    await db.category.create({
      data: { name: P + "Coffee", kind: "expense", parentId: food },
    })
  ).id;
  salary = (
    await db.category.create({ data: { name: P + "Salary", kind: "income" } })
  ).id;
});

afterEach(async () => {
  await db.transaction.deleteMany({
    where: { account: { name: { startsWith: P } } },
  });
  await db.account.deleteMany({ where: { name: { startsWith: P } } });
  await db.category.deleteMany({
    where: { name: { startsWith: P }, parentId: { not: null } },
  });
  await db.category.deleteMany({ where: { name: { startsWith: P } } });
});
afterAll(() => db.$disconnect());

const expense = (extra: Record<string, string> = {}) =>
  form({
    type: "expense",
    amount: "50.000",
    date: "2026-11-20",
    accountId: bank,
    categoryId: coffee,
    note: P + "cf",
    ...extra,
  });

describe("số dư sau khi thêm, sửa, xoá", () => {
  test("chi trừ, thu cộng", async () => {
    expect(await createTransaction(expense())).toEqual({ ok: true });
    expect(await balance(bank)).toBe(950_000n);
    await createTransaction(
      form({
        type: "income",
        amount: "2.000.000",
        date: "2026-11-21",
        accountId: bank,
        categoryId: salary,
        note: P + "luong",
      }),
    );
    expect(await balance(bank)).toBe(2_950_000n);
  });

  test("chuyển khoản: trừ ví nguồn, cộng ví đích, bỏ danh mục", async () => {
    const r = await createTransaction(
      form({
        type: "transfer",
        amount: "300000",
        date: "2026-11-20",
        accountId: bank,
        toAccountId: cash,
        categoryId: food,
        note: P + "rut",
      }),
    );
    expect(r.ok).toBe(true);
    expect(await balance(bank)).toBe(700_000n);
    expect(await balance(cash)).toBe(300_000n);
    expect((await txOf("rut")).categoryId).toBeNull();
  });

  test("sửa số tiền và đổi chi thành chuyển khoản", async () => {
    await createTransaction(expense());
    const tx = await txOf("cf");
    await updateTransaction(expense({ id: tx.id, amount: "80.000" }));
    expect(await balance(bank)).toBe(920_000n);

    await updateTransaction(
      form({
        id: tx.id,
        type: "transfer",
        amount: "80.000",
        date: "2026-11-20",
        accountId: bank,
        toAccountId: cash,
        note: P + "cf",
      }),
    );
    expect(await balance(bank)).toBe(920_000n);
    expect(await balance(cash)).toBe(80_000n);
  });

  test("xoá giao dịch trả lại số dư", async () => {
    await createTransaction(expense());
    await deleteTransaction((await txOf("cf")).id);
    expect(await balance(bank)).toBe(1_000_000n);
    expect(await deleteTransaction("khong-co")).toEqual({
      ok: false,
      error: "Không tìm thấy giao dịch",
    });
  });

  test("ngày lưu là 00:00 giờ VN", async () => {
    await createTransaction(expense({ date: "2026-11-01" }));
    expect((await txOf("cf")).occurredAt.toISOString()).toBe(
      "2026-10-31T17:00:00.000Z",
    );
  });
});

describe("từ chối dữ liệu sai", () => {
  test.each([
    [{ amount: "0" }, "Số tiền phải là số dương"],
    [{ amount: "-5000" }, "Số tiền phải là số dương"],
    [{ amount: "1,5" }, "Số tiền phải là số dương"],
    [{ date: "2026-02-30" }, "Ngày không hợp lệ"],
    [{ categoryId: "" }, "Chọn danh mục"],
    [{ type: "income" }, "Danh mục không khớp loại thu/chi"],
    [{ note: "x".repeat(201) }, "Ghi chú tối đa 200 ký tự"],
  ])("%j", async (extra, message) => {
    const r = await createTransaction(expense(extra));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });

  test("chuyển khoản thiếu ví nhận hoặc trùng ví", async () => {
    const base = {
      type: "transfer",
      amount: "1000",
      date: "2026-11-20",
      accountId: bank,
      note: P + "t",
    };
    expect(await createTransaction(form(base))).toEqual({
      ok: false,
      error: "Chọn ví nhận",
    });
    expect(
      await createTransaction(form({ ...base, toAccountId: bank })),
    ).toEqual({
      ok: false,
      error: "Ví nhận phải khác ví chuyển",
    });
  });

  test("không ghi vào ví đã lưu trữ, nhưng sửa giao dịch cũ của ví đó vẫn được", async () => {
    expect(await createTransaction(expense({ accountId: archived }))).toEqual({
      ok: false,
      error: "Ví đã lưu trữ",
    });
    const old = await db.transaction.create({
      data: {
        type: "expense",
        amount: 1000n,
        accountId: archived,
        categoryId: food,
        occurredAt: new Date(),
        note: P + "old",
      },
    });
    const r = await updateTransaction(
      expense({
        id: old.id,
        accountId: archived,
        amount: "2000",
        note: P + "old",
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

describe("lọc danh sách", () => {
  beforeEach(async () => {
    await createTransaction(
      expense({ date: "2026-10-31", note: P + "Cà phê sữa" }),
    );
    await createTransaction(
      expense({ date: "2026-11-01", categoryId: food, note: P + "Cơm trưa" }),
    );
    await createTransaction(
      form({
        type: "transfer",
        amount: "100000",
        date: "2026-11-02",
        accountId: bank,
        toAccountId: cash,
        note: P + "Rút tiền",
      }),
    );
  });
  const notes = async (sp: Record<string, string>) =>
    (await listTransactions(parseTxFilters(sp))).items
      .map((t) => t.note?.replace(P, ""))
      .filter(Boolean);

  test("theo khoảng ngày giờ VN", async () => {
    expect(await notes({ from: "2026-11-01", to: "2026-11-30", q: P })).toEqual(
      ["Rút tiền", "Cơm trưa"],
    );
    expect(await notes({ from: "2026-10-31", to: "2026-10-31", q: P })).toEqual(
      ["Cà phê sữa"],
    );
  });

  test("danh mục cha gồm cả danh mục con", async () => {
    expect(await notes({ category: food })).toEqual(["Cơm trưa", "Cà phê sữa"]);
    expect(await notes({ category: coffee })).toEqual(["Cà phê sữa"]);
  });

  test("ví gồm cả tiền chuyển vào; lọc theo loại", async () => {
    expect(await notes({ account: cash })).toEqual(["Rút tiền"]);
    expect(await notes({ account: bank, type: "expense" })).toEqual([
      "Cơm trưa",
      "Cà phê sữa",
    ]);
  });

  test("tìm theo ghi chú không phân biệt hoa thường", async () => {
    expect(await notes({ q: "CƠM" })).toEqual(["Cơm trưa"]);
  });

  test("tìm không dấu", async () => {
    expect(await notes({ q: "ca phe" })).toEqual(["Cà phê sữa"]);
    expect(await notes({ q: "COM TRUA" })).toEqual(["Cơm trưa"]);
  });

  test("bỏ qua tham số lạ", () => {
    expect(parseTxFilters({ type: "abc", page: "-3", source: "x" })).toEqual({
      from: undefined,
      to: undefined,
      accountId: undefined,
      categoryId: undefined,
      type: undefined,
      source: undefined,
      q: undefined,
      page: 1,
    });
  });
});
