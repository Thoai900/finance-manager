import { Suspense } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import { ImportWizard } from "@/components/import/import-wizard";
import { UndoImportButton } from "@/components/import/undo-import-button";
import { PageHeader } from "@/components/page-header";
import { formatVnDate } from "@/lib/dates";
import { listAccounts } from "@/server/queries/accounts";
import { listCategoryTree } from "@/server/queries/categories";
import { listImportBatches } from "@/server/queries/imports";

const utcDate = (d: Date) =>
  d.toISOString().slice(0, 10).split("-").reverse().join("/");

async function Wizard() {
  const [accounts, tree] = await Promise.all([
    listAccounts(),
    listCategoryTree(),
  ]);
  const active = accounts.filter((a) => !a.archived);
  if (active.length === 0)
    return <GlassCard>Chưa có ví nào. Hãy thêm ví trong Cài đặt.</GlassCard>;
  return (
    <ImportWizard
      accounts={active.map((a) => ({ id: a.id, name: a.name }))}
      defaultAccountId={(active.find((a) => a.type === "bank") ?? active[0]).id}
      categories={tree.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        children: c.children.map((ch) => ({ id: ch.id, name: ch.name })),
      }))}
    />
  );
}

async function History() {
  const batches = await listImportBatches();
  if (batches.length === 0)
    return <p className="px-5 py-4 text-fg-muted">Chưa nhập sao kê nào.</p>;
  return (
    <ul>
      {batches.map((b) => (
        <li
          key={b.id}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border px-5 py-3"
        >
          <div>
            <p className="font-medium">
              {b.account.name} · {utcDate(b.periodFrom)} – {utcDate(b.periodTo)}
            </p>
            <p className="text-sm text-fg-muted">
              Nhập {b.importedCount} giao dịch
              {b.skippedCount ? `, bỏ qua ${b.skippedCount}` : ""} · ngày{" "}
              {formatVnDate(b.createdAt)}
            </p>
          </div>
          <UndoImportButton batchId={b.id} count={b.importedCount} />
        </li>
      ))}
    </ul>
  );
}

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Nhập sao kê" />
      <div className="flex flex-col gap-6">
        <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
          <Wizard />
        </Suspense>
        <GlassCard strong className="p-0">
          <h2 className="px-5 py-3 font-semibold">Lịch sử nhập</h2>
          <Suspense
            fallback={<p className="px-5 py-4 text-fg-muted">Đang tải…</p>}
          >
            <History />
          </Suspense>
        </GlassCard>
      </div>
    </>
  );
}
