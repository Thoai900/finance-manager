"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseVnd } from "@/lib/money";
import { type ActionResult, fail, OK } from "./result";

// TODO(Giai đoạn 2): kiểm tra đăng nhập ở đầu mọi Server Action.

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên ví")
    .max(50, "Tên ví tối đa 50 ký tự"),
  type: z.enum(["cash", "bank", "credit", "ewallet"], {
    error: "Chọn loại ví",
  }),
  initialBalance: z.string().transform((s, ctx) => {
    const value = parseVnd(s === "" ? "0" : s);
    if (value === null) {
      ctx.addIssue({
        code: "custom",
        message: "Số dư không hợp lệ. Ví dụ: 1.250.000",
      });
      return z.NEVER;
    }
    return value;
  }),
});

function readAccount(formData: FormData) {
  return accountSchema.safeParse({
    name: formData.get("name") ?? "",
    type: formData.get("type"),
    initialBalance: formData.get("initialBalance") ?? "",
  });
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = readAccount(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.account.create({ data: parsed.data });
  refresh();
  return OK;
}

export async function updateAccount(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const parsed = readAccount(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { count } = await db.account.updateMany({
    where: { id },
    data: parsed.data,
  });
  if (count === 0) return fail("Không tìm thấy ví");
  refresh();
  return OK;
}

export async function setAccountArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { count } = await db.account.updateMany({
    where: { id },
    data: { archived },
  });
  if (count === 0) return fail("Không tìm thấy ví");
  refresh();
  return OK;
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const used = await db.transaction.count({
    where: { OR: [{ accountId: id }, { toAccountId: id }] },
  });
  const imports = await db.importBatch.count({ where: { accountId: id } });
  if (used > 0 || imports > 0) {
    return fail(
      "Ví đã có giao dịch nên không xoá được. Hãy lưu trữ ví thay vì xoá.",
    );
  }
  const { count } = await db.account.deleteMany({ where: { id } });
  if (count === 0) return fail("Không tìm thấy ví");
  refresh();
  return OK;
}
