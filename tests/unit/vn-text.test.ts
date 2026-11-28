import { expect, test } from "vitest";
import { buildSearchText, normalizeVn } from "@/lib/vn-text";

test.each([
  ["Cà phê sữa đá", "ca phe sua da"],
  ["ĐIỆN NƯỚC", "dien nuoc"],
  ["  Highlands   Coffee\n", "highlands coffee"],
  ["Hoá đơn & tiện ích", "hoa don & tien ich"],
  ["THANH TOAN QUA MOCA", "thanh toan qua moca"],
])("%j → %j", (input, expected) => {
  expect(normalizeVn(input)).toBe(expected);
});

test("buildSearchText gộp các phần, bỏ phần trống", () => {
  expect(buildSearchText("Cơm trưa", null, "QUÁN ĂN")).toBe("com trua quan an");
  expect(buildSearchText(null, undefined, "")).toBeNull();
});
