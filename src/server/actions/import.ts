"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { vnDateToUtc } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatVnd } from "@/lib/money";
import { normalizeVn } from "@/lib/vn-text";
import { loadBalances } from "../queries/balances";
import { type Analysis, analyzeStatement } from "../import/service";
import { StatementError } from "../import/techcombank";
import type { ImportResult, PreviewResult } from "../import/types";
import { type ActionResult, fail, OK } from "./result";
import { requireOwner } from "../auth-guard";

async function analyze(
  formData: FormData,
): Promise<Analysis | { error: string }> {
  const file = formData.get("file");
  const accountId = String(formData.get("accountId") ?? "");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Chọn file sao kê" };
  if (!accountId) return { error: "Chọn ví" };
  try {
    return await analyzeStatement(file, accountId);
  } catch (e) {
    if (e instanceof StatementError) return { error: e.message };
    throw e;
  }
}

/** Đọc file và trả về bản xem trước. Không ghi gì vào database. */
export async function previewStatement(
  formData: FormData,
): Promise<PreviewResult> {
  await requireOwner();
  const a = await analyze(formData);
  if ("error" in a) return { ok: false, error: a.error };
  const file = formData.get("file") as File;
  const s = a.statement;
  const duplicateCount = a.rows.filter((r) => r.duplicate).length;
  return {
    ok: true,
    preview: {
      fileName: file.name,
      accountId: a.account.id,
      accountName: a.account.name,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      opening: formatVnd(s.opening),
      closing: formatVnd(s.closing),
      totalDebit: formatVnd(s.totalDebit),
      totalCredit: formatVnd(s.totalCredit),
      newCount: a.rows.length - duplicateCount,
      duplicateCount,
      setsInitialBalance: a.setsInitialBalance,
      balanceBefore: formatVnd(a.balanceBefore),
      balanceAfter: formatVnd(a.balanceAfter),
      matchesClosing: a.balanceAfter === s.closing,
      rows: a.rows.map((r) => ({
        key: r.importKey,
        line: r.line,
        date: r.date,
        counterparty: r.counterparty,
        description: r.rawDescription,
        type: r.type,
        amount: formatVnd(r.amount),
        duplicate: r.duplicate,
        categoryId: r.suggestedCategoryId,
      })),
    },
  };
}

const choicesSchema = z.object({
  /** Danh mục người dùng chọn ở màn xem trước, theo khoá dòng. null = chưa phân loại. */
  categories: z.record(z.string(), z.string().nullable()),
  /** Ghi nhớ quy tắc: đối tác → danh mục. */
  remember: z
    .array(
      z.object({
        counterparty: z.string().min(1).max(200),
        categoryId: z.string(),
      }),
    )
    .max(500),
});

/** Đọc lại file trên server (không tin dữ liệu số tiền từ trình duyệt) và ghi các dòng mới. */
export async function importStatement(
  formData: FormData,
): Promise<ImportResult> {
  await requireOwner();
  let choices: z.infer<typeof choicesSchema>;
  try {
    choices = choicesSchema.parse(
      JSON.parse(String(formData.get("choices") ?? "{}")),
    );
  } catch {
    return { ok: false, error: "Dữ liệu lựa chọn không hợp lệ" };
  }
  const a = await analyze(formData);
  if ("error" in a) return { ok: false, error: a.error };

  const kindMatches = (categoryId: string | null, type: "income" | "expense") =>
    categoryId === null || a.categoryKinds.get(categoryId) === type;

  const newRows = a.rows.filter((r) => !r.duplicate);
  if (newRows.length === 0)
    return {
      ok: false,
      error:
        "Không có giao dịch mới: mọi dòng trong file đã được nhập trước đó",
    };

  const data: Prisma.TransactionCreateManyInput[] = [];
  for (const r of newRows) {
    const categoryId =
      r.importKey in choices.categories
        ? choices.categories[r.importKey]
        : r.suggestedCategoryId;
    if (!kindMatches(categoryId, r.type))
      return {
        ok: false,
        error: `Dòng ${r.line}: danh mục không khớp loại thu/chi`,
      };
    data.push({
      type: r.type,
      amount: r.amount,
      accountId: a.account.id,
      categoryId,
      occurredAt: vnDateToUtc(r.date)!,
      rawDescription: r.rawDescription,
      counterparty: r.counterparty,
      counterpartyBank: r.counterpartyBank,
      importKey: r.importKey,
      searchText: r.searchText,
    });
  }
  for (const rule of choices.remember) {
    if (!a.categoryKinds.has(rule.categoryId))
      return { ok: false, error: "Không tìm thấy danh mục của quy tắc" };
  }

  const s = a.statement;
  const accountId = a.account.id;
  const { imported, balanceAfter } = await db.$transaction(async (tx) => {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    const batch = await tx.importBatch.create({
      data: {
        accountId,
        fileName: (formData.get("file") as File).name.slice(0, 200),
        periodFrom: new Date(`${s.periodFrom}T00:00:00Z`),
        periodTo: new Date(`${s.periodTo}T00:00:00Z`),
        openingBalance: s.opening,
        closingBalance: s.closing,
        rowCount: a.rows.length,
        importedCount: 0,
        skippedCount: 0,
        initialBalanceBefore: a.setsInitialBalance
          ? account.initialBalance
          : null,
      },
    });
    if (a.setsInitialBalance) {
      await tx.account.update({
        where: { id: accountId },
        data: { initialBalance: s.opening },
      });
    }
    // skipDuplicates: an toàn nếu cùng file được nhập song song.
    const { count } = await tx.transaction.createMany({
      data: data.map((d) => ({ ...d, importBatchId: batch.id })),
      skipDuplicates: true,
    });
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { importedCount: count, skippedCount: a.rows.length - count },
    });

    const existingRules = await tx.categoryRule.findMany({
      where: { field: "counterparty" },
    });
    for (const rule of choices.remember) {
      const same = existingRules.find(
        (r) => normalizeVn(r.pattern) === normalizeVn(rule.counterparty),
      );
      if (same) {
        await tx.categoryRule.update({
          where: { id: same.id },
          data: {
            categoryId: rule.categoryId,
            priority: Math.max(same.priority, 10),
          },
        });
      } else {
        await tx.categoryRule.create({
          data: {
            field: "counterparty",
            pattern: rule.counterparty.trim(),
            categoryId: rule.categoryId,
            priority: 10,
          },
        });
      }
    }
    const balances = await loadBalances(accountId, tx);
    return { imported: count, balanceAfter: balances.get(accountId)! };
  });

  refresh();
  return {
    ok: true,
    summary: {
      imported,
      skipped: a.rows.length - imported,
      balanceAfter: formatVnd(balanceAfter),
      closing: formatVnd(s.closing),
      matchesClosing: balanceAfter === s.closing,
    },
  };
}

/** Hoàn tác cả một lần nhập: xoá các giao dịch của lần đó và trả lại số dư ban đầu nếu lần đó đã đặt. */
export async function undoImport(batchId: string): Promise<ActionResult> {
  await requireOwner();
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) return fail("Không tìm thấy lần nhập");
  await db.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { importBatchId: batchId } });
    if (batch.initialBalanceBefore !== null) {
      await tx.account.update({
        where: { id: batch.accountId },
        data: { initialBalance: batch.initialBalanceBefore },
      });
    }
    await tx.importBatch.delete({ where: { id: batchId } });
  });
  refresh();
  return OK;
}
