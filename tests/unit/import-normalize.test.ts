import { describe, expect, test } from "vitest";
import {
  type Rule,
  sortRules,
  suggestCategory,
} from "@/server/import/categorize";
import { actualDate, toImportRows } from "@/server/import/normalize";
import type { StatementRow } from "@/server/import/techcombank";

const row = (over: Partial<StatementRow>): StatementRow => ({
  line: 1,
  date: "2026-11-09",
  counterparty: null,
  counterpartyBank: null,
  description: null,
  ref: null,
  debit: 0n,
  credit: 0n,
  balance: null,
  ...over,
});

describe("actualDate", () => {
  test("lấy NGAY trong diễn giải (giao dịch cuối tuần ghi sang thứ Hai)", () => {
    expect(
      actualDate(
        row({
          date: "2026-11-09",
          description: "THANH TOAN QUA MOCA NGAY 08/11/2026 APPCODE",
        }),
      ),
    ).toBe("2026-11-08");
    expect(
      actualDate(
        row({
          date: "2026-11-02",
          description: "THANH TOAN QUA MOCA NGAY 31/10/2026",
        }),
      ),
    ).toBe("2026-10-31");
  });
  test("bỏ qua NGAY sau ngày sao kê, quá 7 ngày trước, hoặc không hợp lệ", () => {
    expect(
      actualDate(row({ date: "2026-11-09", description: "NGAY 10/11/2026" })),
    ).toBe("2026-11-09");
    expect(
      actualDate(row({ date: "2026-11-09", description: "NGAY 01/10/2026" })),
    ).toBe("2026-11-09");
    expect(
      actualDate(row({ date: "2026-11-09", description: "NGAY 31/02/2026" })),
    ).toBe("2026-11-09");
    expect(
      actualDate(
        row({ date: "2026-11-09", description: "Ngay 09/11/2026 09:27:25" }),
      ),
    ).toBe("2026-11-09");
  });
});

describe("toImportRows", () => {
  test("Có → thu, Nợ → chi; Số bút toán làm khoá", () => {
    const [a, b] = toImportRows([
      row({
        ref: "FT1",
        debit: 30000n,
        counterparty: "MOCA",
        description: "Thanh toán",
      }),
      row({ ref: "FT2", credit: 84n }),
    ]);
    expect(a).toMatchObject({
      importKey: "FT1",
      type: "expense",
      amount: 30000n,
      searchText: "thanh toan moca",
    });
    expect(b).toMatchObject({ importKey: "FT2", type: "income", amount: 84n });
  });

  test("dòng không có Số bút toán: khoá ổn định qua các lần đọc, khác nhau khi trùng y hệt", () => {
    const interest = row({
      date: "2026-10-31",
      credit: 84n,
      description: "Tra lai so du",
    });
    const first = toImportRows([interest, interest]);
    const again = toImportRows([interest, interest]);
    expect(first[0].importKey).toMatch(/^h:/);
    expect(first[0].importKey).not.toBe(first[1].importKey);
    expect(again.map((r) => r.importKey)).toEqual(
      first.map((r) => r.importKey),
    );
    const other = toImportRows([{ ...interest, credit: 85n }]);
    expect(other[0].importKey).not.toBe(first[0].importKey);
  });
});

describe("suggestCategory", () => {
  const kinds = new Map<string, "income" | "expense">([
    ["an_uong", "expense"],
    ["di_lai", "expense"],
    ["tien_lai", "income"],
    ["chuyen", "expense"],
  ]);
  const rules: Rule[] = sortRules([
    {
      field: "counterparty",
      pattern: "MOCA",
      categoryId: "di_lai",
      priority: 0,
    },
    {
      field: "counterparty",
      pattern: "highlands",
      categoryId: "an_uong",
      priority: 0,
    },
    {
      field: "description",
      pattern: "Trả lãi số dư",
      categoryId: "tien_lai",
      priority: 0,
    },
    {
      field: "description",
      pattern: "sang diem upoint",
      categoryId: "chuyen",
      priority: 0,
    },
    {
      field: "counterparty",
      pattern: "MOCA.,CORP",
      categoryId: "an_uong",
      priority: 10,
    },
  ]);
  const s = (
    r: Partial<{
      type: "income" | "expense";
      counterparty: string;
      rawDescription: string;
    }>,
  ) =>
    suggestCategory(
      { type: "expense", counterparty: null, rawDescription: null, ...r },
      rules,
      kinds,
    );

  test("khớp không dấu, không phân biệt hoa thường", () => {
    expect(s({ counterparty: "HIGHLANDS COFFEE" })).toBe("an_uong");
    expect(
      s({ type: "income", rawDescription: "Tra lai so du tren tai khoan" }),
    ).toBe("tien_lai");
    expect(
      s({
        rawDescription: "Chuyen tien loi Sinh Loi Tu Dong sang diem Upoint",
      }),
    ).toBe("chuyen");
  });
  test("quy tắc ưu tiên cao thắng", () => {
    expect(s({ counterparty: "MOCA.,CORP" })).toBe("an_uong");
    expect(s({ counterparty: "MOCA KHAC" })).toBe("di_lai");
  });
  test("không áp danh mục khác loại thu/chi; không khớp → null", () => {
    expect(s({ type: "income", counterparty: "HIGHLANDS COFFEE" })).toBeNull();
    expect(s({ counterparty: "KHONG BIET" })).toBeNull();
  });
});
