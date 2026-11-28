"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { type ActionResult, fail, OK } from "./result";
import { requireOwner } from "../auth-guard";

const baseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên danh mục")
    .max(50, "Tên danh mục tối đa 50 ký tự"),
  parentId: z
    .string()
    .nullable()
    .transform((v) => (v ? v : null)),
  excludeFromReports: z.boolean(),
});

const createSchema = baseSchema.extend({
  kind: z.enum(["income", "expense"], { error: "Chọn loại danh mục" }),
});

function readBase(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    parentId: formData.get("parentId") as string | null,
    excludeFromReports: formData.get("excludeFromReports") === "on",
  };
}

/** Danh mục cha phải là danh mục gốc (tối đa 2 cấp) và cùng loại thu/chi. */
async function checkParent(parentId: string, kind: "income" | "expense") {
  const parent = await db.category.findUnique({ where: { id: parentId } });
  if (!parent) return "Không tìm thấy danh mục cha";
  if (parent.parentId) return "Chỉ được tạo tối đa 2 cấp danh mục";
  if (parent.kind !== kind) return "Danh mục cha phải cùng loại thu/chi";
  return null;
}

export async function createCategory(
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = createSchema.safeParse({
    ...readBase(formData),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.parentId) {
    const error = await checkParent(data.parentId, data.kind);
    if (error) return fail(error);
  }
  await db.category.create({ data });
  refresh();
  return OK;
}

/** Không đổi được loại thu/chi sau khi tạo. */
export async function updateCategory(
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const parsed = baseSchema.safeParse(readBase(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;

  const current = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!current) return fail("Không tìm thấy danh mục");
  if (data.parentId) {
    if (data.parentId === id)
      return fail("Danh mục không thể là cha của chính nó");
    if (current._count.children > 0) {
      return fail(
        "Danh mục đang có danh mục con nên không thể chuyển thành danh mục con",
      );
    }
    const error = await checkParent(data.parentId, current.kind);
    if (error) return fail(error);
  }
  await db.category.update({ where: { id }, data });
  refresh();
  return OK;
}

/** Xoá danh mục cũng xoá ngân sách và quy tắc phân loại của nó. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireOwner();
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, transactions: true } } },
  });
  if (!category) return fail("Không tìm thấy danh mục");
  if (category._count.transactions > 0) {
    return fail(
      `Danh mục đang có ${category._count.transactions} giao dịch. Hãy chuyển các giao dịch sang danh mục khác trước.`,
    );
  }
  if (category._count.children > 0) {
    return fail("Hãy xoá hoặc chuyển các danh mục con trước.");
  }
  await db.category.delete({ where: { id } });
  refresh();
  return OK;
}
