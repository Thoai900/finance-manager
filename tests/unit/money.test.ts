import { describe, expect, test } from "vitest";
import { formatVnd, formatVndPlain, parseVnd } from "@/lib/money";

describe("formatVnd", () => {
  test.each([
    [0n, "0 đ"],
    [500n, "500 đ"],
    [1250000n, "1.250.000 đ"],
    [-30000n, "-30.000 đ"],
    [9_000_000_000_000n, "9.000.000.000.000 đ"],
  ])("%s → %s", (input, expected) => {
    expect(formatVnd(input)).toBe(expected);
  });

  test("nhận cả number", () => {
    expect(formatVnd(1848396)).toBe("1.848.396 đ");
  });

  test("formatVndPlain không có ký hiệu tiền", () => {
    expect(formatVndPlain(1250000n)).toBe("1.250.000");
    expect(formatVndPlain(-5000n)).toBe("-5.000");
  });
});

describe("parseVnd", () => {
  test.each([
    ["1250000", 1250000n],
    ["1.250.000", 1250000n],
    ["1,250,000", 1250000n],
    ["1 250 000", 1250000n],
    ["  50000 ", 50000n],
    ["1.250.000 đ", 1250000n],
    ["1.250.000₫", 1250000n],
    ["1250000 VND", 1250000n],
    ["-30.000", -30000n],
    ["(3,215,328)", -3215328n],
    ["0", 0n],
    ["2,000,000", 2000000n],
  ])("%j → %s", (input, expected) => {
    expect(parseVnd(input)).toBe(expected);
  });

  test.each([
    "",
    "abc",
    "1.5",
    "1,25",
    "1.250,000",
    "12.34.567",
    "1..000",
    "--5",
    "đ",
    "1.2345",
  ])("%j không hợp lệ", (input) => {
    expect(parseVnd(input)).toBeNull();
  });

  test("format rồi parse lại cho đúng giá trị", () => {
    for (const v of [0n, 7n, 999n, 1000n, 1848396n, -18428848n]) {
      expect(parseVnd(formatVnd(v))).toBe(v);
    }
  });
});
