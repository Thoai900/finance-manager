// Điều phối nhập sao kê: đọc file → chuẩn hoá → tìm trùng → gợi ý danh mục → tính số dư dự kiến.
import { db } from "@/lib/db";
import { loadBalances } from "../queries/balances";
import { sortRules, suggestCategory } from "./categorize";
import { type ImportRow, toImportRows } from "./normalize";
import {
  type ParsedStatement,
  parseTechcombank,
  StatementError,
} from "./techcombank";
import { readXlsxRows } from "./xlsx";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type AnalyzedRow = ImportRow & {
  duplicate: boolean;
  suggestedCategoryId: string | null;
};

export type Analysis = {
  statement: ParsedStatement;
  account: { id: string; name: string };
  rows: AnalyzedRow[];
  categoryKinds: Map<string, "income" | "expense">;
  /** Ví chưa có giao dịch nào → lần nhập này đặt số dư ban đầu = số dư đầu kỳ. */
  setsInitialBalance: boolean;
  balanceBefore: bigint;
  balanceAfter: bigint;
};

export async function analyzeStatement(
  file: File,
  accountId: string,
): Promise<Analysis> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new StatementError("Hãy chọn file Excel (.xlsx) tải từ Techcombank");
  }
  if (file.size > MAX_FILE_BYTES)
    throw new StatementError("File quá lớn (tối đa 5 MB)");

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) throw new StatementError("Không tìm thấy ví");
  if (account.archived) throw new StatementError("Ví đã lưu trữ");

  let sheet;
  try {
    sheet = await readXlsxRows(await file.arrayBuffer());
  } catch {
    throw new StatementError(
      "Không đọc được file Excel. Hãy tải lại file sao kê từ Techcombank.",
    );
  }
  const statement = parseTechcombank(sheet);
  const importRows = toImportRows(statement.rows);

  const [existing, rules, categories, txCount, balances] = await Promise.all([
    db.transaction.findMany({
      where: {
        accountId,
        importKey: { in: importRows.map((r) => r.importKey) },
      },
      select: { importKey: true },
    }),
    db.categoryRule.findMany(),
    db.category.findMany({ select: { id: true, kind: true } }),
    db.transaction.count({
      where: { OR: [{ accountId }, { toAccountId: accountId }] },
    }),
    loadBalances(accountId),
  ]);
  const existingKeys = new Set(existing.map((t) => t.importKey));
  const categoryKinds = new Map(categories.map((c) => [c.id, c.kind]));
  const sortedRules = sortRules(rules);

  const rows: AnalyzedRow[] = importRows.map((r) => ({
    ...r,
    duplicate: existingKeys.has(r.importKey),
    suggestedCategoryId: suggestCategory(r, sortedRules, categoryKinds),
  }));

  const setsInitialBalance = txCount === 0;
  const balanceBefore = balances.get(accountId) ?? account.initialBalance;
  const delta = rows
    .filter((r) => !r.duplicate)
    .reduce((sum, r) => sum + (r.type === "income" ? r.amount : -r.amount), 0n);
  const balanceAfter =
    (setsInitialBalance ? statement.opening : balanceBefore) + delta;

  return {
    statement,
    account: { id: account.id, name: account.name },
    rows,
    categoryKinds,
    setsInitialBalance,
    balanceBefore,
    balanceAfter,
  };
}
