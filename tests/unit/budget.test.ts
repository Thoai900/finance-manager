import { describe, expect, test } from "vitest";
import { budgetUsage, spentWithChildren } from "@/lib/budget";
import {
  currentVnMonth,
  formatMonth,
  isValidMonth,
  shiftMonth,
  toVnIsoDate,
  vnMonthRange,
} from "@/lib/dates";

describe("budgetUsage", () => {
  test.each([
    [0n, 1000000n, 0, "ok"],
    [799999n, 1000000n, 79, "ok"],
    [800000n, 1000000n, 80, "warning"],
    [1000000n, 1000000n, 100, "warning"],
    [1000001n, 1000000n, 100, "over"],
    [2500000n, 1000000n, 250, "over"],
  ])("đã chi %s / %s → %s%% (%s)", (spent, budget, percent, status) => {
    expect(budgetUsage(spent, budget)).toEqual({ percent, status });
  });

  test("ngân sách phải dương", () => {
    expect(() => budgetUsage(1n, 0n)).toThrow();
  });
});

test("danh mục cha gồm cả chi của danh mục con", () => {
  const parentOf = new Map<string, string | null>([
    ["an_uong", null],
    ["ca_phe", "an_uong"],
    ["di_lai", null],
  ]);
  const own = new Map([
    ["an_uong", 300000n],
    ["ca_phe", 120000n],
    ["di_lai", 50000n],
  ]);
  const total = spentWithChildren(own, parentOf);
  expect(total.get("an_uong")).toBe(420000n);
  expect(total.get("ca_phe")).toBe(120000n);
  expect(total.get("di_lai")).toBe(50000n);
});

describe("tháng theo giờ VN", () => {
  test("khoảng tháng: 23:30 ngày 31/10 thuộc tháng 10, 00:30 ngày 1/11 thuộc tháng 11", () => {
    const oct = vnMonthRange("2026-10");
    const lateOct = new Date("2026-10-31T16:30:00Z"); // 23:30 giờ VN
    const earlyNov = new Date("2026-10-31T17:30:00Z"); // 00:30 giờ VN ngày 1/11
    expect(lateOct >= oct.gte && lateOct < oct.lt).toBe(true);
    expect(earlyNov >= oct.lt).toBe(true);
    expect(oct.gte.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(oct.lt.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  test("cộng trừ tháng qua năm", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
  });

  test("tháng hiện tại theo giờ VN, định dạng, kiểm tra hợp lệ", () => {
    expect(currentVnMonth(new Date("2026-11-30T17:30:00Z"))).toBe("2026-12");
    expect(formatMonth("2026-03")).toBe("Tháng 3/2026");
    expect(isValidMonth("2026-11")).toBe(true);
    expect(["2026-13", "2026-1", "abc", ""].some(isValidMonth)).toBe(false);
    expect(toVnIsoDate(vnMonthRange("2028-02").lt)).toBe("2028-03-01");
  });
});
