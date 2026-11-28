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
  importStatement,
  previewStatement,
  undoImport,
} from "@/server/actions/import";
import { updateTransaction } from "@/server/actions/transactions";
import { loadBalances } from "@/server/queries/balances";
import {
  listTransactions,
  parseTxFilters,
} from "@/server/queries/transactions";
import { buildStatementXlsx, type FakeRow } from "../fixtures/techcombank";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => ({ email: "owner@test" }),
}));

const P = "__test_import__";
const SENDER = "NGUOI GUI TEST IMPORT";
let accountId: string;

const NOV: FakeRow[] = [
  {
    date: "29/10/2026",
    counterparty: "MOCA.,CORP",
    description: "THANH TOAN QUA MOCA NGAY 29/10/2026",
    ref: P + "FT1",
    debit: 30000,
  },
  {
    date: "31/10/2026",
    description: "Tra lai so du tren tai khoan - thang 10/2026",
    credit: 84,
  },
  {
    date: "02/11/2026",
    counterparty: SENDER,
    description: "chuyen tien",
    ref: P + "FT2",
    credit: 2000000,
  },
  {
    date: "02/11/2026",
    counterparty: "QUAN CA PHE LA",
    description: "Cà phê sáng",
    ref: P + "FT3",
    debit: 45000,
  },
  {
    date: "09/11/2026",
    counterparty: "MOCA.,CORP",
    description: "THANH TOAN QUA MOCA NGAY 08/11/2026",
    ref: P + "FT4",
    debit: 69000,
  },
];
const NOV_OPENING = 573504;
const NOV_CLOSING = NOV_OPENING - 30000 + 84 + 2000000 - 45000 - 69000;

async function file(
  opts: { from: string; to: string; opening: number; rows: FakeRow[] },
  name = "SaoKeTK.xlsx",
) {
  return new File([await buildStatementXlsx(opts)], name);
}
async function form(f: File, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("file", f);
  fd.set("accountId", accountId);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}
const novFile = () =>
  file({
    from: "29/10/2026",
    to: "27/11/2026",
    opening: NOV_OPENING,
    rows: NOV,
  });
const balance = async () => (await loadBalances(accountId)).get(accountId);
const choices = (c: object = {}) => ({
  choices: JSON.stringify({ categories: {}, remember: [], ...c }),
});

beforeEach(async () => {
  accountId = (
    await db.account.create({ data: { name: P + "TCB", type: "bank" } })
  ).id;
});
afterEach(async () => {
  await db.transaction.deleteMany({
    where: { account: { name: { startsWith: P } } },
  });
  await db.importBatch.deleteMany({
    where: { account: { name: { startsWith: P } } },
  });
  await db.account.deleteMany({ where: { name: { startsWith: P } } });
  await db.categoryRule.deleteMany({ where: { pattern: SENDER } });
});
afterAll(() => db.$disconnect());

describe("xem trước", () => {
  test("đếm dòng, gợi ý danh mục theo quy tắc mặc định, số dư dự kiến khớp cuối kỳ", async () => {
    const r = await previewStatement(await form(await novFile()));
    if (!r.ok) throw new Error(r.error);
    const p = r.preview;
    expect(p).toMatchObject({
      periodFrom: "2026-10-29",
      periodTo: "2026-11-27",
      newCount: 5,
      duplicateCount: 0,
      setsInitialBalance: true,
      opening: "573.504 đ",
      matchesClosing: true,
    });
    const byKey = Object.fromEntries(p.rows.map((row) => [row.key, row]));
    expect(byKey[P + "FT1"]).toMatchObject({
      type: "expense",
      amount: "30.000 đ",
      categoryId: "cat_di_lai",
    });
    expect(byKey[P + "FT4"].date).toBe("2026-11-08"); // lấy NGAY trong diễn giải
    const interest = p.rows.find((row) =>
      row.description?.startsWith("Tra lai"),
    );
    expect(interest).toMatchObject({
      type: "income",
      categoryId: "cat_tien_lai",
    });
    expect(byKey[P + "FT2"].categoryId).toBeNull();
    expect(await db.transaction.count({ where: { accountId } })).toBe(0); // xem trước không ghi gì
  });

  test.each([["đuôi file sai", "SaoKe.pdf", "file Excel (.xlsx)"]])(
    "từ chối %s",
    async (_n, name, message) => {
      const r = await previewStatement(
        await form(
          new File(
            [
              await buildStatementXlsx({
                from: "01/11/2026",
                to: "02/11/2026",
                opening: 0,
                rows: [],
              }),
            ],
            name,
          ),
        ),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(message);
    },
  );

  test("từ chối file hỏng và ví đã lưu trữ", async () => {
    const broken = await previewStatement(
      await form(new File([new Uint8Array([1, 2, 3])], "x.xlsx")),
    );
    expect(broken).toEqual({
      ok: false,
      error: expect.stringContaining("Không đọc được file Excel"),
    });
    await db.account.update({
      where: { id: accountId },
      data: { archived: true },
    });
    const archived = await previewStatement(await form(await novFile()));
    expect(archived).toEqual({ ok: false, error: "Ví đã lưu trữ" });
  });
});

describe("nhập", () => {
  test("nhập, đặt số dư ban đầu, ghi nhớ quy tắc; nhập lại không thêm dòng; hai kỳ chồng nhau; hoàn tác", async () => {
    // Lần 1: chọn danh mục cho dòng của người gửi và ghi nhớ quy tắc.
    const r1 = await importStatement(
      await form(
        await novFile(),
        choices({
          categories: { [P + "FT2"]: "cat_thu_khac" },
          remember: [{ counterparty: SENDER, categoryId: "cat_thu_khac" }],
        }),
      ),
    );
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.summary).toMatchObject({
      imported: 5,
      skipped: 0,
      matchesClosing: true,
    });
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: accountId } }))
        .initialBalance,
    ).toBe(BigInt(NOV_OPENING));
    expect(await balance()).toBe(BigInt(NOV_CLOSING));
    const ft2 = await db.transaction.findFirstOrThrow({
      where: { importKey: P + "FT2" },
    });
    expect(ft2).toMatchObject({
      categoryId: "cat_thu_khac",
      counterparty: SENDER,
      type: "income",
      amount: 2000000n,
    });
    expect(
      await db.categoryRule.findFirst({ where: { pattern: SENDER } }),
    ).toMatchObject({ categoryId: "cat_thu_khac", priority: 10 });

    // Tìm không dấu trong nội dung sao kê.
    const found = await listTransactions(
      parseTxFilters({ q: "ca phe sang", account: accountId }),
    );
    expect(found.items.map((t) => t.importKey)).toEqual([P + "FT3"]);

    // Nhập lại cùng file: không có dòng mới.
    const again = await importStatement(await form(await novFile(), choices()));
    expect(again).toEqual({
      ok: false,
      error: expect.stringContaining("Không có giao dịch mới"),
    });
    const preview = await previewStatement(await form(await novFile()));
    expect(preview.ok && preview.preview.duplicateCount).toBe(5);

    // Kỳ sau chồng 1 dòng (FT4) + 2 dòng mới; quy tắc vừa nhớ được áp dụng.
    const DEC: FakeRow[] = [
      NOV[4],
      {
        date: "28/11/2026",
        counterparty: SENDER,
        description: "chuyen tien",
        ref: P + "FT5",
        credit: 500000,
      },
      {
        date: "29/11/2026",
        counterparty: "HIGHLANDS COFFEE",
        description: "order",
        ref: P + "FT6",
        debit: 55000,
      },
    ];
    const decOpening = NOV_CLOSING + 69000; // trước FT4
    const decFile = await file({
      from: "09/11/2026",
      to: "30/11/2026",
      opening: decOpening,
      rows: DEC,
    });
    const p2 = await previewStatement(await form(decFile));
    if (!p2.ok) throw new Error(p2.error);
    expect(p2.preview).toMatchObject({
      newCount: 2,
      duplicateCount: 1,
      setsInitialBalance: false,
      matchesClosing: true,
    });
    expect(p2.preview.rows.find((r) => r.key === P + "FT5")?.categoryId).toBe(
      "cat_thu_khac",
    );
    expect(p2.preview.rows.find((r) => r.key === P + "FT6")?.categoryId).toBe(
      "cat_an_uong",
    );
    const r2 = await importStatement(await form(decFile, choices()));
    expect(r2.ok && r2.summary).toMatchObject({
      imported: 2,
      skipped: 1,
      matchesClosing: true,
    });
    expect(await balance()).toBe(BigInt(NOV_CLOSING + 500000 - 55000));

    // Hoàn tác lần 2 rồi lần 1.
    const batches = await db.importBatch.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
    });
    expect(batches.map((b) => [b.importedCount, b.skippedCount])).toEqual([
      [5, 0],
      [2, 1],
    ]);
    expect(await undoImport(batches[1].id)).toEqual({ ok: true });
    expect(await balance()).toBe(BigInt(NOV_CLOSING));
    expect(await undoImport(batches[0].id)).toEqual({ ok: true });
    expect(await db.transaction.count({ where: { accountId } })).toBe(0);
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: accountId } }))
        .initialBalance,
    ).toBe(0n);
    expect(await undoImport(batches[0].id)).toEqual({
      ok: false,
      error: "Không tìm thấy lần nhập",
    });
  });

  test("danh mục sai loại thu/chi bị từ chối và không ghi gì", async () => {
    const r = await importStatement(
      await form(
        await novFile(),
        choices({ categories: { [P + "FT2"]: "cat_an_uong" } }),
      ),
    );
    expect(r.ok).toBe(false);
    expect(await db.transaction.count({ where: { accountId } })).toBe(0);
    expect(await db.importBatch.count({ where: { accountId } })).toBe(0);
  });

  test("giao dịch từ sao kê chỉ sửa được danh mục và ghi chú", async () => {
    await importStatement(await form(await novFile(), choices()));
    const tx = await db.transaction.findFirstOrThrow({
      where: { importKey: P + "FT3" },
    });
    const edit = (over: Record<string, string>) => {
      const fd = new FormData();
      const values = {
        id: tx.id,
        type: "expense",
        amount: "45000",
        date: "2026-11-02",
        accountId,
        categoryId: "cat_an_uong",
        note: "sáng",
        ...over,
      };
      for (const [k, v] of Object.entries(values)) fd.set(k, v);
      return updateTransaction(fd);
    };
    expect(await edit({ amount: "46000" })).toEqual({
      ok: false,
      error: "Giao dịch từ sao kê chỉ sửa được danh mục và ghi chú",
    });
    expect(await edit({ date: "2026-11-03" })).toMatchObject({ ok: false });
    expect(await edit({})).toEqual({ ok: true });
    const updated = await db.transaction.findUniqueOrThrow({
      where: { id: tx.id },
    });
    expect(updated).toMatchObject({
      categoryId: "cat_an_uong",
      note: "sáng",
      amount: 45000n,
    });
    expect(updated.searchText).toContain("sang");
    expect(updated.searchText).toContain("quan ca phe la");
  });
});
