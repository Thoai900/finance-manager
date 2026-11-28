import { describe, expect, test } from "vitest";
import { parseTechcombank, StatementError } from "@/server/import/techcombank";
import { readXlsxRows } from "@/server/import/xlsx";
import { buildStatementXlsx, type FakeRow } from "../fixtures/techcombank";

const ROWS: FakeRow[] = [
  {
    date: "29/10/2026",
    counterparty: "MOCA.,CORP",
    bank: "TECHCOMBANK",
    description: "THANH TOAN QUA MOCA NGAY 29/10/2026",
    ref: "FT0001",
    debit: 30000,
  },
  {
    date: "31/10/2026",
    bank: "TECHCOMBANK",
    description: "Tra lai so du tren tai khoan - thang 10/2026",
    credit: 84,
  },
  {
    date: "02/11/2026",
    counterparty: "NGUOI GUI A",
    bank: "AGRIBANK",
    description: "chuyen tien",
    ref: "FT0002",
    credit: 2000000,
  },
  {
    date: "02/11/2026",
    counterparty: "HIGHLANDS COFFEE",
    bank: "MB",
    description: "Thanh toan order 123",
    ref: "FT0003",
    debit: 120000,
  },
];

const parse = async (opts: Parameters<typeof buildStatementXlsx>[0]) =>
  parseTechcombank(await readXlsxRows(await buildStatementXlsx(opts)));

describe("parseTechcombank", () => {
  test("đọc đủ giao dịch, kỳ sao kê, đầu kỳ, cuối kỳ; bỏ qua phụ lục Sinh lời", async () => {
    const s = await parse({
      from: "29/10/2026",
      to: "27/11/2026",
      opening: 573504,
      rows: ROWS,
      withAppendix: true,
    });
    expect(s.periodFrom).toBe("2026-10-29");
    expect(s.periodTo).toBe("2026-11-27");
    expect(s.opening).toBe(573504n);
    expect(s.totalDebit).toBe(150000n);
    expect(s.totalCredit).toBe(2000084n);
    expect(s.closing).toBe(573504n + 2000084n - 150000n);
    expect(s.rows).toHaveLength(4);
    expect(s.rows[0]).toMatchObject({
      date: "2026-10-29",
      counterparty: "MOCA.,CORP",
      counterpartyBank: "TECHCOMBANK",
      ref: "FT0001",
      debit: 30000n,
      credit: 0n,
      balance: 543504n,
    });
    expect(s.rows[1]).toMatchObject({
      ref: null,
      counterparty: null,
      credit: 84n,
    });
    expect(s.rows.some((r) => r.ref === "FT_APPENDIX_1")).toBe(false);
  });

  test("sao kê không có giao dịch", async () => {
    const s = await parse({
      from: "01/12/2026",
      to: "31/12/2026",
      opening: 1000,
      rows: [],
    });
    expect(s.rows).toEqual([]);
    expect(s.closing).toBe(1000n);
  });

  test.each([
    [
      "tổng không khớp Cộng doanh số",
      { totals: { debit: 1, credit: 2000084 } },
      "Cộng doanh số",
    ],
    ["cuối kỳ sai", { closing: 999 }, "Số dư cuối kỳ"],
  ])("từ chối khi %s", async (_name, extra, message) => {
    await expect(
      parse({
        from: "29/10/2026",
        to: "27/11/2026",
        opening: 573504,
        rows: ROWS,
        ...extra,
      }),
    ).rejects.toThrow(message);
  });

  test("từ chối dòng có cả Nợ và Có", async () => {
    const rows = [{ date: "01/11/2026", ref: "X", debit: 5, credit: 5 }];
    await expect(
      parse({ from: "01/11/2026", to: "02/11/2026", opening: 0, rows }),
    ).rejects.toThrow("đúng một");
  });

  test("từ chối file không phải sao kê", () => {
    const notStatement = () =>
      parseTechcombank([{ line: 1, cells: [{ col: 1, text: "Hello" }] }]);
    expect(notStatement).toThrow(StatementError);
    expect(notStatement).toThrow("Không tìm thấy bảng giao dịch");
  });
});
