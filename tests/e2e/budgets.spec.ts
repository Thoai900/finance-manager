import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

const PREFIX = "E2E Ngân sách ";

async function sql(query: string, params: unknown[] = []) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await client.query(query, params);
  } finally {
    await client.end();
  }
}

async function cleanup() {
  await sql("DELETE FROM transactions WHERE note LIKE $1", [`${PREFIX}%`]);
  await sql(
    "DELETE FROM budgets WHERE category_id IN (SELECT id FROM categories WHERE name LIKE $1)",
    [`${PREFIX}%`],
  );
  await sql("DELETE FROM categories WHERE name LIKE $1", [`${PREFIX}%`]);
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test("đặt ngân sách, chi 85% thì cảnh báo, giảm hạn mức thì báo vượt", async ({
  page,
}, info) => {
  const name = `${PREFIX}${info.project.name}`;
  const id = `e2e_budget_${info.project.name}`;
  await sql(
    "INSERT INTO categories (id, name, kind) VALUES ($1, $2, 'expense')",
    [id, name],
  );
  await sql(
    `INSERT INTO transactions (id, type, amount, account_id, category_id, occurred_at, note, updated_at)
     VALUES ($1, 'expense', 85000, 'acc_techcombank', $2, now(), $3, now())`,
    [`${id}_tx`, id, name],
  );

  await page.goto("/budgets", { waitUntil: "networkidle" });
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Chưa đặt ngân sách");
  await row.getByRole("button", { name: `Đặt ngân sách ${name}` }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hạn mức (đ)").fill("100.000");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();

  await expect(row).toContainText("Đã chi 85.000 đ / 100.000 đ · 85%");
  await expect(row).toContainText("Sắp hết · còn 15.000 đ");
  await expect(row.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "85",
  );

  await row.getByRole("button", { name: `Sửa ngân sách ${name}` }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Hạn mức (đ)")).toHaveValue("100.000");
  await dialog.getByLabel("Hạn mức (đ)").fill("80000");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("Vượt 5.000 đ");
  await expect(row.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
});
