import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { buildStatementXlsx } from "../fixtures/techcombank";

// Ví test riêng (không đụng ví Techcombank), dọn sạch sau khi chạy.
const ACCOUNT_PREFIX = "E2E Import ";
const SENDER = "E2E NGUOI GUI";

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
  const accounts = "SELECT id FROM accounts WHERE name LIKE $1";
  await sql(`DELETE FROM transactions WHERE account_id IN (${accounts})`, [
    `${ACCOUNT_PREFIX}%`,
  ]);
  await sql(`DELETE FROM import_batches WHERE account_id IN (${accounts})`, [
    `${ACCOUNT_PREFIX}%`,
  ]);
  await sql("DELETE FROM accounts WHERE name LIKE $1", [`${ACCOUNT_PREFIX}%`]);
  await sql("DELETE FROM category_rules WHERE pattern = $1", [SENDER]);
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test("nhập sao kê: xem trước, chọn danh mục, nhập, nhập lại bị bỏ qua, hoàn tác", async ({
  page,
}, info) => {
  const accountName = `${ACCOUNT_PREFIX}${info.project.name}`;
  await sql(
    "INSERT INTO accounts (id, name, type, initial_balance) VALUES ($1, $2, 'bank', 0)",
    [`e2e_import_${info.project.name}`, accountName],
  );
  const xlsx = Buffer.from(
    await buildStatementXlsx({
      from: "01/11/2026",
      to: "30/11/2026",
      opening: 1000000,
      withAppendix: true,
      rows: [
        {
          date: "03/11/2026",
          counterparty: "HIGHLANDS COFFEE",
          description: "order 1",
          ref: `E2E-${info.project.name}-1`,
          debit: 55000,
        },
        {
          date: "05/11/2026",
          counterparty: SENDER,
          description: "chuyen tien",
          ref: `E2E-${info.project.name}-2`,
          credit: 300000,
        },
        {
          date: "30/11/2026",
          description: "Tra lai so du tren tai khoan",
          credit: 120,
        },
      ],
    }),
  );
  const upload = {
    name: "SaoKeTK_E2E.xlsx",
    mimeType: "application/octet-stream",
    buffer: xlsx,
  };

  await page.goto("/import", { waitUntil: "networkidle" });
  await page
    .getByRole("combobox", { name: "Ví" })
    .selectOption({ label: accountName });
  await page.getByLabel("File sao kê (.xlsx)").setInputFiles(upload);
  await page.getByRole("button", { name: "Đọc file" }).click();

  await expect(page.getByText("File hợp lệ")).toBeVisible();
  await expect(page.getByText(/3\s*giao dịch mới/)).toBeVisible();
  await expect(page.getByText("1.245.120 đ, khớp số dư cuối kỳ")).toBeVisible();

  // Dòng của người gửi chưa có quy tắc → chọn "Thu khác" và ghi nhớ.
  const senderRow = page.getByRole("listitem").filter({ hasText: SENDER });
  await senderRow.getByRole("combobox").selectOption({ label: "Thu khác" });
  await senderRow.getByLabel("Ghi nhớ cho đối tác này").check();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "HIGHLANDS" })
      .getByRole("combobox"),
  ).toHaveValue("cat_an_uong");

  await page.getByRole("button", { name: "Nhập 3 giao dịch" }).click();
  await expect(page.getByText("Đã nhập 3 giao dịch")).toBeVisible();
  await expect(page.getByText("khớp số dư cuối kỳ trên sao kê")).toBeVisible();
  const rule = await sql(
    "SELECT category_id FROM category_rules WHERE pattern = $1",
    [SENDER],
  );
  expect(rule.rows[0]?.category_id).toBe("cat_thu_khac");

  // Nhập lại cùng file: không có dòng mới.
  await page.getByRole("button", { name: "Nhập file khác" }).click();
  await page
    .getByRole("combobox", { name: "Ví" })
    .selectOption({ label: accountName });
  await page.getByLabel("File sao kê (.xlsx)").setInputFiles(upload);
  await page.getByRole("button", { name: "Đọc file" }).click();
  await expect(page.getByText(/0\s*giao dịch mới/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nhập 0 giao dịch" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Huỷ" }).click();

  // Hoàn tác từ lịch sử.
  const history = page.getByRole("listitem").filter({ hasText: accountName });
  await history.getByRole("button", { name: "Hoàn tác" }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("button", { name: "Hoàn tác" }).click();
  // Khi hộp thoại mở, phần còn lại của trang bị ẩn khỏi cây trợ năng → chờ đóng rồi mới kiểm tra.
  await expect(confirm).toBeHidden();
  await expect(history).toHaveCount(0);
  const left = await sql(
    "SELECT count(*)::int AS n FROM transactions WHERE account_id = $1",
    [`e2e_import_${info.project.name}`],
  );
  expect(left.rows[0].n).toBe(0);
});
