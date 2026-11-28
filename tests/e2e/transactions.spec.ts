import "dotenv/config";
import { expect, type Page, test } from "@playwright/test";
import { Client } from "pg";
import { parseVnd } from "../../src/lib/money";

const NOTE_PREFIX = "E2E ";

// Dọn giao dịch test kể cả khi test lỗi giữa chừng. Dùng pg trực tiếp vì Prisma Client là ESM.
test.afterAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("DELETE FROM transactions WHERE note LIKE $1", [
    `${NOTE_PREFIX}%`,
  ]);
  await client.end();
});

async function techcombankBalance(page: Page) {
  await page.goto("/settings/accounts", { waitUntil: "networkidle" });
  // React có thể giữ nội dung mới trong vùng ẩn vài trăm ms trước khi hiện: chờ chỉ còn một bản.
  const balance = page
    .locator("li", { hasText: "Techcombank" })
    .getByTestId("balance");
  await expect(balance).toHaveCount(1);
  const text = await balance.innerText();
  const value = parseVnd(text);
  expect(value).not.toBeNull();
  return value!;
}

test("thêm khoản chi làm số dư giảm đúng số tiền, xoá thì trả lại", async ({
  page,
}, info) => {
  const note = `${NOTE_PREFIX}${info.project.name} ${Date.now()}`;
  const before = await techcombankBalance(page);

  await page.goto("/transactions");
  await page.getByRole("button", { name: "Thêm giao dịch" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm giao dịch" });
  await dialog.getByLabel("Số tiền (đ)").fill("12.345");
  await dialog
    .getByRole("combobox", { name: "Ví", exact: true })
    .selectOption({ label: "Techcombank" });
  await dialog
    .getByRole("combobox", { name: "Danh mục" })
    .selectOption({ label: "Ăn uống" });
  await dialog.getByLabel("Ghi chú").fill(note);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("button", { name: new RegExp(note) });
  await expect(row).toContainText("−12.345 đ");
  expect(await techcombankBalance(page)).toBe(before - 12345n);

  await page.goto("/transactions?q=" + encodeURIComponent(note));
  await page.getByRole("button", { name: new RegExp(note) }).click();
  await page
    .getByRole("dialog", { name: "Sửa giao dịch" })
    .getByRole("button", { name: "Xoá" })
    .click();
  await page
    .getByRole("dialog", { name: "Xoá giao dịch?" })
    .getByRole("button", { name: "Xoá giao dịch" })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(note) }),
  ).toHaveCount(0);
  expect(await techcombankBalance(page)).toBe(before);
});
