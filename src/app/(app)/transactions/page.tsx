import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { PageHeader } from "@/components/page-header";
import {
  type AccountOption,
  type CategoryOption,
  TransactionFormDialog,
} from "@/components/transactions/transaction-dialog";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { cn } from "@/lib/cn";
import { formatVnDate, todayVnIso, toVnIsoDate } from "@/lib/dates";
import { formatVnd, formatVndPlain } from "@/lib/money";
import { listAccounts } from "@/server/queries/accounts";
import { listCategoryTree } from "@/server/queries/categories";
import {
  getLastUsedAccountId,
  listTransactions,
  PAGE_SIZE,
  parseTxFilters,
  type TxFilters,
} from "@/server/queries/transactions";

type Tx = Awaited<ReturnType<typeof listTransactions>>["items"][number];

function TransactionRow({ tx }: { tx: Tx }) {
  const title =
    tx.type === "transfer"
      ? "Chuyển khoản"
      : tx.category
        ? tx.category.parent
          ? `${tx.category.parent.name} › ${tx.category.name}`
          : tx.category.name
        : "Chưa phân loại";
  const detail = tx.note ?? tx.counterparty ?? tx.rawDescription;
  return (
    <span className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left">
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="flex items-center gap-1 truncate text-sm text-fg-muted">
          {tx.account.name}
          {tx.toAccount ? (
            <>
              <ArrowRight className="size-3 shrink-0" aria-label="sang" />
              {tx.toAccount.name}
            </>
          ) : null}
          {detail ? <span className="truncate"> · {detail}</span> : null}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 font-medium tabular-nums",
          tx.type === "income" && "text-income",
          tx.type === "expense" && "text-expense",
        )}
      >
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatVnd(tx.amount)}
      </span>
    </span>
  );
}

function pageHref(filters: TxFilters, page: number) {
  const params = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["from", filters.from],
    ["to", filters.to],
    ["account", filters.accountId],
    ["category", filters.categoryId],
    ["type", filters.type],
    ["source", filters.source],
    ["q", filters.q],
  ];
  for (const [k, v] of entries) if (v) params.set(k, v);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: PageProps<"/transactions">["searchParams"];
}) {
  const filters = parseTxFilters(await searchParams);
  const [accounts, tree, lastAccountId, { items, total }] = await Promise.all([
    listAccounts(),
    listCategoryTree(),
    getLastUsedAccountId(),
    listTransactions(filters),
  ]);

  const accountOptions: AccountOption[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    archived: a.archived,
  }));
  const categoryOptions: CategoryOption[] = tree.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    children: c.children.map((ch) => ({ id: ch.id, name: ch.name })),
  }));
  const ctx = {
    accounts: accountOptions,
    categories: categoryOptions,
    defaultAccountId:
      lastAccountId ?? accounts.find((a) => !a.archived)?.id ?? "",
    today: todayVnIso(),
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Nhóm theo ngày (giờ VN), giữ thứ tự mới nhất trước.
  const groups: { day: string; label: string; items: Tx[] }[] = [];
  for (const tx of items) {
    const day = toVnIsoDate(tx.occurredAt);
    if (groups.at(-1)?.day !== day)
      groups.push({ day, label: formatVnDate(tx.occurredAt), items: [] });
    groups.at(-1)!.items.push(tx);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <TransactionFormDialog
          {...ctx}
          trigger={
            <GlassButton variant="primary">
              <Plus className="size-4" aria-hidden />
              Thêm giao dịch
            </GlassButton>
          }
        />
      </div>
      <TransactionFilters
        filters={filters}
        accounts={accountOptions}
        categories={categoryOptions}
      />

      <GlassCard strong className="p-0">
        {items.length === 0 ? (
          <p className="p-5 text-fg-muted">
            {total === 0 && filters.page === 1
              ? "Chưa có giao dịch nào."
              : "Không có giao dịch ở trang này."}
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.day}>
              <h2 className="border-glass-border bg-fg/5 px-5 py-2 text-sm text-fg-muted [&:not(:first-child)]:border-t">
                {g.label}
              </h2>
              <ul>
                {g.items.map((tx) => (
                  <li key={tx.id} className="border-t border-glass-border">
                    <TransactionFormDialog
                      {...ctx}
                      transaction={{
                        id: tx.id,
                        type: tx.type,
                        amount: formatVndPlain(tx.amount),
                        date: toVnIsoDate(tx.occurredAt),
                        accountId: tx.accountId,
                        toAccountId: tx.toAccountId,
                        categoryId: tx.categoryId,
                        note: tx.note ?? "",
                        source: tx.importBatchId
                          ? {
                              counterparty: tx.counterparty,
                              description: tx.rawDescription,
                            }
                          : null,
                      }}
                      trigger={
                        <button
                          type="button"
                          className="block w-full hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset"
                        >
                          <TransactionRow tx={tx} />
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </GlassCard>

      <nav
        aria-label="Phân trang"
        className="mt-4 flex items-center justify-between text-sm text-fg-muted"
      >
        <span>
          {total} giao dịch · Trang {Math.min(filters.page, pages)}/{pages}
        </span>
        <span className="flex gap-2">
          {filters.page > 1 ? (
            <Link
              className="glass rounded-xl px-3 py-2 text-fg"
              href={pageHref(filters, filters.page - 1)}
            >
              Trang trước
            </Link>
          ) : null}
          {filters.page < pages ? (
            <Link
              className="glass rounded-xl px-3 py-2 text-fg"
              href={pageHref(filters, filters.page + 1)}
            >
              Trang sau
            </Link>
          ) : null}
        </span>
      </nav>
    </>
  );
}

export default function TransactionsPage({
  searchParams,
}: PageProps<"/transactions">) {
  return (
    <>
      <PageHeader title="Giao dịch" />
      <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
