import "dotenv/config";
import { afterAll, expect, test, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
// Giả lập người chưa đăng nhập: requireOwner chuyển hướng (ném lỗi) như redirect() thật.
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => {
    throw new Error("NEXT_REDIRECT:/login");
  },
}));

afterAll(() => db.$disconnect());

const modules = {
  accounts: () => import("@/server/actions/accounts"),
  categories: () => import("@/server/actions/categories"),
  transactions: () => import("@/server/actions/transactions"),
  import: () => import("@/server/actions/import"),
  rules: () => import("@/server/actions/rules"),
};

test("mọi Server Action đều từ chối khi chưa đăng nhập và không ghi dữ liệu", async () => {
  const checked: string[] = [];
  for (const [name, load] of Object.entries(modules)) {
    for (const [fn, action] of Object.entries(await load())) {
      if (typeof action !== "function") continue;
      const fd = new FormData();
      fd.set("name", "__hacker__");
      fd.set("type", "cash");
      fd.set("kind", "expense");
      await expect(
        (action as (...a: unknown[]) => Promise<unknown>)(fd, true),
        `${name}.${fn}`,
      ).rejects.toThrow("NEXT_REDIRECT");
      checked.push(`${name}.${fn}`);
    }
  }
  expect(checked).toHaveLength(16);
  // Các file test khác chạy song song nên không so tổng số dòng; kiểm tra đúng dữ liệu bài này cố ghi.
  expect(await db.account.count({ where: { name: "__hacker__" } })).toBe(0);
  expect(await db.category.count({ where: { name: "__hacker__" } })).toBe(0);
});
