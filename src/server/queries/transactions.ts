import type { Prisma } from "@/generated/prisma/client";
import { vnDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { normalizeVn } from "@/lib/vn-text";
import { requireOwner } from "@/server/auth-guard";

export const PAGE_SIZE = 50;
/** Giá trị bộ lọc danh mục cho giao dịch thu/chi chưa có danh mục. */
export const UNCATEGORIZED = "none";

export type TxFilters = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense" | "transfer";
  source?: "manual" | "import";
  q?: string;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Đọc bộ lọc từ URL; bỏ qua giá trị lạ. */
export function parseTxFilters(sp: SearchParams): TxFilters {
  const one = (k: string) => {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s : undefined;
  };
  const type = one("type");
  const source = one("source");
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    from: one("from"),
    to: one("to"),
    accountId: one("account"),
    categoryId: one("category"),
    type:
      type === "income" || type === "expense" || type === "transfer"
        ? type
        : undefined,
    source: source === "manual" || source === "import" ? source : undefined,
    q: one("q")?.slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function buildTxWhere(f: TxFilters): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];
  const range = vnDateRange(f.from, f.to);
  if (range.gte || range.lt) and.push({ occurredAt: range });
  if (f.accountId)
    and.push({
      OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }],
    });
  // Lọc theo danh mục cha thì gồm cả danh mục con.
  if (f.categoryId === UNCATEGORIZED) {
    and.push({ categoryId: null, type: { not: "transfer" } });
  } else if (f.categoryId) {
    and.push({
      OR: [
        { categoryId: f.categoryId },
        { category: { parentId: f.categoryId } },
      ],
    });
  }
  if (f.type) and.push({ type: f.type });
  if (f.source === "manual") and.push({ importBatchId: null });
  if (f.source === "import") and.push({ importBatchId: { not: null } });
  // Tìm không dấu: "ca phe" khớp "Cà phê".
  const q = f.q ? normalizeVn(f.q) : "";
  if (q) and.push({ searchText: { contains: q } });
  return { AND: and };
}

export async function listTransactions(f: TxFilters) {
  await requireOwner();
  const where = buildTxWhere(f);
  const [items, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: {
          select: { name: true, parent: { select: { name: true } } },
        },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.transaction.count({ where }),
  ]);
  return { items, total };
}

/** Ví của giao dịch nhập tay gần nhất, dùng làm ví mặc định khi thêm giao dịch. */
export async function getLastUsedAccountId(): Promise<string | null> {
  await requireOwner();
  const last = await db.transaction.findFirst({
    where: { importBatchId: null, account: { archived: false } },
    orderBy: { createdAt: "desc" },
    select: { accountId: true },
  });
  return last?.accountId ?? null;
}
