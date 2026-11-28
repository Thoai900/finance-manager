"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { vnDateToUtc } from "@/lib/dates";
import { db } from "@/lib/db";
import { parseVnd } from "@/lib/money";
import { buildSearchText } from "@/lib/vn-text";
import { type ActionResult, fail, OK } from "./result";
import { requireOwner } from "../auth-guard";

const MAX_AMOUNT = 1_000_000_000_000_000n; // 1 triệu tỷ đồng: chặn số gõ nhầm quá lớn
const optionalId = z
  .string()
  .nullable()
  .transform((v) => (v ? v : null));

const txSchema = z.object({
  type: z.enum(["income", "expense", "transfer"], {
    error: "Chọn loại giao dịch",
  }),
  amount: z.string().transform((s, ctx) => {
    const v = parseVnd(s);
    if (v === null || v <= 0n || v > MAX_AMOUNT) {
      ctx.addIssue({
        code: "custom",
        message: "Số tiền phải là số dương. Ví dụ: 50.000",
      });
      return z.NEVER;
    }
    return v;
  }),
  date: z.string().transform((s, ctx) => {
    const d = vnDateToUtc(s);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Ngày không hợp lệ" });
      return z.NEVER;
    }
    return d;
  }),
  accountId: z.string().min(1, "Chọn ví"),
  toAccountId: optionalId,
  categoryId: optionalId,
  note: z
    .string()
    .trim()
    .max(200, "Ghi chú tối đa 200 ký tự")
    .transform((v) => v || null),
});

type TxInput = z.infer<typeof txSchema>;

function read(formData: FormData) {
  const get = (k: string) => formData.get(k) as string | null;
  return txSchema.safeParse({
    type: get("type"),
    amount: get("amount") ?? "",
    date: get("date") ?? "",
    accountId: get("accountId") ?? "",
    toAccountId: get("toAccountId"),
    categoryId: get("categoryId"),
    note: get("note") ?? "",
  });
}

/**
 * Kiểm tra liên kết. `previous`: giao dịch đang sửa — cho phép giữ ví đã lưu trữ nếu không đổi ví.
 * Trả về dữ liệu đã chuẩn hoá để ghi (transfer không có danh mục, thu/chi không có ví đích).
 */
async function validateLinks(
  input: TxInput,
  previous?: { accountId: string; toAccountId: string | null },
) {
  const checkAccount = async (
    id: string,
    prevId: string | null | undefined,
    label: string,
  ) => {
    const acc = await db.account.findUnique({ where: { id } });
    if (!acc) return `Không tìm thấy ${label}`;
    if (acc.archived && id !== prevId)
      return `${label[0].toUpperCase()}${label.slice(1)} đã lưu trữ`;
    return null;
  };

  const accErr = await checkAccount(input.accountId, previous?.accountId, "ví");
  if (accErr) return { error: accErr };

  if (input.type === "transfer") {
    if (!input.toAccountId) return { error: "Chọn ví nhận" };
    if (input.toAccountId === input.accountId)
      return { error: "Ví nhận phải khác ví chuyển" };
    const toErr = await checkAccount(
      input.toAccountId,
      previous?.toAccountId,
      "ví nhận",
    );
    if (toErr) return { error: toErr };
    return { data: { ...input, categoryId: null } };
  }

  if (!input.categoryId) return { error: "Chọn danh mục" };
  const category = await db.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) return { error: "Không tìm thấy danh mục" };
  if (category.kind !== input.type) {
    return { error: "Danh mục không khớp loại thu/chi" };
  }
  return { data: { ...input, toAccountId: null } };
}

export async function createTransaction(
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = read(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { error, data } = await validateLinks(parsed.data);
  if (error) return fail(error);
  const { date, ...rest } = data!;
  await db.transaction.create({
    data: { ...rest, occurredAt: date, searchText: buildSearchText(rest.note) },
  });
  refresh();
  return OK;
}

export async function updateTransaction(
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const current = await db.transaction.findUnique({ where: { id } });
  if (!current) return fail("Không tìm thấy giao dịch");
  const parsed = read(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  // Giao dịch từ sao kê: giữ nguyên số tiền/ngày/ví/loại để đối chiếu với ngân hàng vẫn đúng.
  if (current.importBatchId) {
    const p = parsed.data;
    const changed =
      p.type !== current.type ||
      p.amount !== current.amount ||
      p.accountId !== current.accountId ||
      p.date.getTime() !== current.occurredAt.getTime();
    if (changed)
      return fail("Giao dịch từ sao kê chỉ sửa được danh mục và ghi chú");
  }
  const { error, data } = await validateLinks(parsed.data, current);
  if (error) return fail(error);
  const { date, ...rest } = data!;
  await db.transaction.update({
    where: { id },
    data: {
      ...rest,
      occurredAt: date,
      searchText: buildSearchText(
        rest.note,
        current.rawDescription,
        current.counterparty,
      ),
    },
  });
  refresh();
  return OK;
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requireOwner();
  const { count } = await db.transaction.deleteMany({ where: { id } });
  if (count === 0) return fail("Không tìm thấy giao dịch");
  refresh();
  return OK;
}
