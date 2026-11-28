"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeVn } from "@/lib/vn-text";
import { type ActionResult, fail, OK } from "./result";

// TODO(Giai đoạn 2): kiểm tra đăng nhập ở đầu mọi Server Action.

const ruleSchema = z.object({
  field: z.enum(["counterparty", "description"], {
    error: "Chọn cột để so khớp",
  }),
  pattern: z
    .string()
    .trim()
    .min(2, "Từ khoá tối thiểu 2 ký tự")
    .max(100, "Từ khoá tối đa 100 ký tự")
    .refine((v) => normalizeVn(v).length >= 2, "Từ khoá tối thiểu 2 ký tự"),
  categoryId: z.string().min(1, "Chọn danh mục"),
  priority: z.coerce
    .number({ error: "Độ ưu tiên phải là số nguyên" })
    .int("Độ ưu tiên phải là số nguyên")
    .min(-100)
    .max(100),
});

async function read(formData: FormData) {
  const parsed = ruleSchema.safeParse({
    field: formData.get("field"),
    pattern: formData.get("pattern") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    priority: formData.get("priority") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const category = await db.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) return { error: "Không tìm thấy danh mục" };
  return { data: parsed.data };
}

export async function createRule(formData: FormData): Promise<ActionResult> {
  const { error, data } = await read(formData);
  if (error) return fail(error);
  await db.categoryRule.create({ data: data! });
  refresh();
  return OK;
}

export async function updateRule(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const { error, data } = await read(formData);
  if (error) return fail(error);
  const { count } = await db.categoryRule.updateMany({
    where: { id },
    data: data!,
  });
  if (count === 0) return fail("Không tìm thấy quy tắc");
  refresh();
  return OK;
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const { count } = await db.categoryRule.deleteMany({ where: { id } });
  if (count === 0) return fail("Không tìm thấy quy tắc");
  refresh();
  return OK;
}
