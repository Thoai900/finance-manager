import { expect, test } from "vitest";
import { isOwnerEmail } from "@/lib/owner";

test("đúng email chủ app (không phân biệt hoa thường, khoảng trắng)", () => {
  expect(isOwnerEmail("Me@Gmail.com", " me@gmail.com ")).toBe(true);
});

test("email khác, thiếu email, hoặc chưa cấu hình OWNER_EMAIL → từ chối", () => {
  expect(isOwnerEmail("other@gmail.com", "me@gmail.com")).toBe(false);
  expect(isOwnerEmail(null, "me@gmail.com")).toBe(false);
  expect(isOwnerEmail("", "me@gmail.com")).toBe(false);
  expect(isOwnerEmail("me@gmail.com", undefined)).toBe(false);
  expect(isOwnerEmail("me@gmail.com", "  ")).toBe(false);
});
