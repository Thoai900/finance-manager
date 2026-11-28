import { expect, test } from "@playwright/test";
import { sessionCookie } from "./session";

test.describe("chưa đăng nhập", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("mọi trang trong app chuyển về trang đăng nhập", async ({ page }) => {
    for (const path of [
      "/",
      "/dashboard",
      "/transactions",
      "/import",
      "/settings/accounts",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(
      page.getByRole("button", { name: "Đăng nhập bằng Google" }),
    ).toBeVisible();
  });

  test("trang đăng nhập báo lỗi khi tài khoản không có quyền", async ({
    page,
  }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(
      page.getByText("Tài khoản Google này không có quyền truy cập ứng dụng."),
    ).toBeVisible();
  });
});

test.describe("đăng nhập bằng email khác chủ app", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("có cookie phiên hợp lệ nhưng sai email vẫn không xem được dữ liệu", async ({
    page,
    context,
  }) => {
    await context.addCookies([await sessionCookie("stranger@example.com")]);
    await page.goto("/settings/accounts");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Techcombank")).toHaveCount(0);
  });
});

test("chủ app xem được dữ liệu và đăng xuất được", async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop",
    "nút đăng xuất trên thanh bên chỉ có ở bản máy tính",
  );
  await page.goto("/settings/accounts");
  await expect(page.getByText("Techcombank").first()).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login$/);
});
