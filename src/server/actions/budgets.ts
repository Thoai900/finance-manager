"use server";

import { refresh } from "next/cache";
import { isValidMonth, shiftMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { parseVnd } from "@/lib/money";
import { requireOwner } from "../auth-guard";
import { type ActionResult, fail, OK } from "./result";

const MAX_BUDGET = 1_000_000_000_000_000n;

async function checkCategory(categoryId: string) {
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) return "Không tìm thấy danh mục";
  if (category.kind !== "expense") return "Chỉ đặt ngân sách cho danh mục chi";
  if (category.excludeFromReports)
    return "Danh mục này không tính vào thống kê nên không đặt ngân sách";
  return null;
}

/** Đặt hạn mức tháng cho một danh mục. Để trống hoặc 0 = bỏ ngân sách. */
export async function setBudget(formData: FormData): Promise<ActionResult> {
  await requireOwner();
  const categoryId = String(formData.get("categoryId") ?? "");
  const month = String(formData.get("month") ?? "");
  const raw = String(formData.get("amount") ?? "").trim();
  if (!isValidMonth(month)) return fail("Tháng không hợp lệ");
  const error = await checkCategory(categoryId);
  if (error) return fail(error);

  const amount = raw === "" ? 0n : parseVnd(raw);
  if (amount === null || amount < 0n || amount > MAX_BUDGET) {
    return fail("Số tiền không hợp lệ. Ví dụ: 3.000.000");
  }
  if (amount === 0n) {
    await db.budget.deleteMany({ where: { categoryId, month } });
  } else {
    await db.budget.upsert({
      where: { categoryId_month: { categoryId, month } },
      create: { categoryId, month, amount },
      update: { amount },
    });
  }
  refresh();
  return OK;
}

/** Chép ngân sách tháng trước sang tháng này; danh mục đã có ngân sách thì giữ nguyên. */
export async function copyBudgetsFromPreviousMonth(
  month: string,
): Promise<ActionResult> {
  await requireOwner();
  if (!isValidMonth(month)) return fail("Tháng không hợp lệ");
  const previous = await db.budget.findMany({
    where: {
      month: shiftMonth(month, -1),
      category: { kind: "expense", excludeFromReports: false },
    },
  });
  if (previous.length === 0) return fail("Tháng trước chưa có ngân sách");
  await db.budget.createMany({
    data: previous.map((b) => ({
      categoryId: b.categoryId,
      month,
      amount: b.amount,
    })),
    skipDuplicates: true,
  });
  refresh();
  return OK;
}
