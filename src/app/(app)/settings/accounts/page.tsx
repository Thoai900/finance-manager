import { Plus } from "lucide-react";
import { Suspense } from "react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { PageHeader } from "@/components/page-header";
import {
  AccountFormDialog,
  AccountRowActions,
} from "@/components/settings/account-dialogs";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { formatVnd, formatVndPlain } from "@/lib/money";
import { listAccounts } from "@/server/queries/accounts";
import { getAccountBalances } from "@/server/queries/balances";

async function AccountList() {
  const [accounts, balances] = await Promise.all([
    listAccounts(),
    getAccountBalances(),
  ]);
  if (accounts.length === 0) {
    return <p className="p-5 text-fg-muted">Chưa có ví nào.</p>;
  }
  return (
    <ul>
      {accounts.map((a, i) => (
        <li
          key={a.id}
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${i > 0 ? "border-t border-glass-border" : ""}`}
        >
          <div>
            <p className="font-medium">
              {a.name}
              {a.archived ? (
                <span className="ml-2 rounded-md border border-glass-border px-1.5 py-0.5 text-xs text-fg-muted">
                  Đã lưu trữ
                </span>
              ) : null}
            </p>
            <p
              className="text-lg font-semibold tabular-nums"
              data-testid="balance"
            >
              {formatVnd(balances.get(a.id) ?? a.initialBalance)}
            </p>
            <p className="text-sm text-fg-muted">
              {ACCOUNT_TYPE_LABELS[a.type]} · Số dư ban đầu{" "}
              <span className="tabular-nums">
                {formatVnd(a.initialBalance)}
              </span>
            </p>
          </div>
          <AccountRowActions
            account={{
              id: a.id,
              name: a.name,
              type: a.type,
              initialBalance: formatVndPlain(a.initialBalance),
              archived: a.archived,
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        title="Ví"
        back={{ href: "/settings", label: "Cài đặt" }}
        action={
          <AccountFormDialog
            trigger={
              <GlassButton variant="primary">
                <Plus className="size-4" aria-hidden />
                Thêm ví
              </GlassButton>
            }
          />
        }
      />
      <GlassCard strong className="p-0">
        <Suspense fallback={<p className="p-5 text-fg-muted">Đang tải…</p>}>
          <AccountList />
        </Suspense>
      </GlassCard>
    </>
  );
}
