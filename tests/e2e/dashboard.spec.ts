import "dotenv/config";
import { expect, type Page, test } from "@playwright/test";
import { Client } from "pg";
import { parseVnd } from "../../src/lib/money";

const NOTE = "E2E Tổng quan";

async function sql(query: string, params: unknown[] = []) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await client.query(query, params);
  } finally {
    await client.end();
  }
}
const cleanup = () => sql("DELETE FROM transactions WHERE note = $1", [NOTE]);
test.beforeAll(cleanup);
test.afterAll(cleanup);

/** Đọc số tiền trong thẻ số liệu theo nhãn (dữ liệu khác có thể có sẵn, nên chỉ so chênh lệch). */
async function tile(page: Page, label: string) {
  const text = await page
    .locator("section[aria-label='Số liệu chính'] > div")
    .filter({ hasText: label })
    .locator("p")
    .nth(1)
    .innerText();
  return parseVnd(text.replace("+", ""))!;
}

test("thêm khoản chi làm tăng Chi tháng này đúng số tiền; chuyển khoản không tính", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "dữ liệu dùng chung, chạy một lần là đủ",
  );
  await sql(
    `INSERT INTO transactions (id, type, amount, account_id, category_id, occurred_at, note, updated_at)
     VALUES ('e2e_dash_seed', 'expense', 1000, 'acc_techcombank', 'cat_chi_khac', now(), $1, now())`,
    [NOTE],
  );
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const before = await tile(page, "Chi tháng này");

  await sql(
    `INSERT INTO transactions (id, type, amount, account_id, category_id, occurred_at, note, updated_at)
     VALUES ('e2e_dash_1', 'expense', 12345, 'acc_techcombank', 'cat_an_uong', now(), $1, now())`,
    [NOTE],
  );
  await sql(
    `INSERT INTO accounts (id, name, type) VALUES ('e2e_dash_cash', 'E2E ví tạm', 'cash') ON CONFLICT DO NOTHING`,
  );
  await sql(
    `INSERT INTO transactions (id, type, amount, account_id, to_account_id, occurred_at, note, updated_at)
     VALUES ('e2e_dash_2', 'transfer', 500000, 'acc_techcombank', 'e2e_dash_cash', now(), $1, now())`,
    [NOTE],
  );
  try {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    expect(await tile(page, "Chi tháng này")).toBe(before + 12345n);

    // Biểu đồ: rê chuột vào cột tháng này hiện tooltip; có bảng số liệu.
    const columns = page.getByRole("button", {
      name: /^Tháng \d+\/\d{4}: thu/,
    });
    await expect(columns).toHaveCount(6);
    await columns.last().hover();
    await expect(page.getByRole("tooltip")).toContainText("Chi");
    await page.getByText("Xem dạng bảng").click();
    await expect(page.locator("table tbody tr")).toHaveCount(6);
  } finally {
    await cleanup();
    await sql("DELETE FROM accounts WHERE id = 'e2e_dash_cash'");
  }
});
