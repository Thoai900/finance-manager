import { describe, expect, test } from "vitest";
import {
  type ReportTx,
  countsInReports,
  expenseByCategory,
  totalsByMonth,
} from "@/lib/report";

const cat = (
  id: string,
  parentId: string | null = null,
  excludeFromReports = false,
) => ({
  id,
  name: id,
  parentId,
  excludeFromReports,
});
const tx = (
  type: ReportTx["type"],
  amount: number,
  iso: string,
  category: ReportTx["category"] = null,
): ReportTx => ({
  type,
  amount: BigInt(amount),
  occurredAt: new Date(iso),
  category,
});

test("chuyển khoản và danh mục không tính thống kê bị loại", () => {
  expect(countsInReports(tx("transfer", 1, "2026-11-01T00:00:00Z"))).toBe(
    false,
  );
  expect(
    countsInReports(
      tx("expense", 1, "2026-11-01T00:00:00Z", cat("moved", null, true)),
    ),
  ).toBe(false);
  expect(countsInReports(tx("expense", 1, "2026-11-01T00:00:00Z"))).toBe(true);
});

describe("totalsByMonth", () => {
  test("chia tháng theo giờ VN, đủ tháng trống, khớp tính tay", () => {
    const txs = [
      tx("income", 12000000, "2026-10-05T03:00:00Z", cat("luong")),
      tx("expense", 300000, "2026-10-31T16:30:00Z", cat("an")), // 23:30 31/10 VN → tháng 10
      tx("expense", 200000, "2026-10-31T17:30:00Z", cat("an")), // 00:30 1/11 VN → tháng 11
      tx("transfer", 5000000, "2026-11-02T03:00:00Z"),
      tx("expense", 400000, "2026-11-03T03:00:00Z", cat("moved", null, true)),
      tx("income", 84, "2026-11-30T03:00:00Z", cat("lai")),
      tx("expense", 999, "2026-07-01T03:00:00Z"), // ngoài khoảng
    ];
    expect(totalsByMonth(txs, ["2026-09", "2026-10", "2026-11"])).toEqual([
      { month: "2026-09", income: 0n, expense: 0n },
      { month: "2026-10", income: 12000000n, expense: 300000n },
      { month: "2026-11", income: 84n, expense: 200000n },
    ]);
  });
});

describe("expenseByCategory", () => {
  const names = new Map([
    ["an", "Ăn uống"],
    ["di", "Đi lại"],
    ["a", "A"],
    ["b", "B"],
    ["c", "C"],
    ["d", "D"],
    ["e", "E"],
  ]);

  test("gộp con vào cha, chưa phân loại riêng, lớn nhất trước, bỏ thu và chuyển khoản", () => {
    const rows = expenseByCategory(
      [
        tx("expense", 300000, "2026-11-01T00:00:00Z", cat("an")),
        tx("expense", 120000, "2026-11-01T00:00:00Z", cat("cafe", "an")),
        tx("expense", 500000, "2026-11-01T00:00:00Z", cat("di")),
        tx("expense", 50000, "2026-11-01T00:00:00Z"),
        tx("income", 9000000, "2026-11-01T00:00:00Z", cat("an")),
        tx("transfer", 700000, "2026-11-01T00:00:00Z"),
      ],
      names,
    );
    expect(rows).toEqual([
      { id: "di", name: "Đi lại", amount: 500000n },
      { id: "an", name: "Ăn uống", amount: 420000n },
      { id: "none", name: "Chưa phân loại", amount: 50000n },
    ]);
  });

  test("quá giới hạn thì gộp đuôi thành Khác", () => {
    const txs = ["a", "b", "c", "d", "e"].map((id, i) =>
      tx("expense", (5 - i) * 1000, "2026-11-01T00:00:00Z", cat(id)),
    );
    const rows = expenseByCategory(txs, names, 3);
    expect(rows.map((r) => [r.name, r.amount])).toEqual([
      ["A", 5000n],
      ["B", 4000n],
      ["Khác", 6000n],
    ]);
  });
});
