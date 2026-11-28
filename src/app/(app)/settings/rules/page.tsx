import { Plus } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { PageHeader } from "@/components/page-header";
import {
  RuleFormDialog,
  RuleRowActions,
} from "@/components/settings/rule-dialogs";
import type { CategoryOption } from "@/components/transactions/transaction-dialog";
import { db } from "@/lib/db";
import { sortRules } from "@/server/import/categorize";
import { listCategoryTree } from "@/server/queries/categories";

const FIELD_LABELS = {
  counterparty: "Đối tác",
  description: "Nội dung",
} as const;

async function RuleList() {
  await connection();
  const [rules, tree] = await Promise.all([
    db.categoryRule.findMany(),
    listCategoryTree(),
  ]);
  const categories: CategoryOption[] = tree.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    children: c.children.map((ch) => ({ id: ch.id, name: ch.name })),
  }));
  const names = new Map(
    tree.flatMap((c) => [
      [c.id, c.name],
      ...c.children.map((ch) => [ch.id, `${c.name} › ${ch.name}`] as const),
    ]),
  );
  const sorted = sortRules(rules);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <RuleFormDialog
          categories={categories}
          trigger={
            <GlassButton variant="primary">
              <Plus className="size-4" aria-hidden />
              Thêm quy tắc
            </GlassButton>
          }
        />
      </div>
      <GlassCard strong className="p-0">
        <p className="px-5 py-3 text-sm text-fg-muted">
          Khi nhập sao kê, quy tắc đầu tiên khớp sẽ gợi ý danh mục. Thứ tự xét:
          độ ưu tiên cao trước, rồi từ khoá dài trước.
        </p>
        {sorted.length === 0 ? (
          <p className="border-t border-glass-border px-5 py-3 text-fg-muted">
            Chưa có quy tắc.
          </p>
        ) : (
          <ul>
            {sorted.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-t border-glass-border px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words">
                    <span className="text-fg-muted">
                      {FIELD_LABELS[r.field]} chứa
                    </span>{" "}
                    “{r.pattern}”
                  </p>
                  <p className="text-sm text-fg-muted">
                    → {names.get(r.categoryId) ?? "?"}
                    {r.priority ? ` · ưu tiên ${r.priority}` : ""}
                  </p>
                </div>
                <RuleRowActions
                  rule={{
                    id: r.id,
                    field: r.field,
                    pattern: r.pattern,
                    categoryId: r.categoryId,
                    priority: r.priority,
                  }}
                  categories={categories}
                />
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}

export default function RulesPage() {
  return (
    <>
      <PageHeader
        title="Quy tắc phân loại"
        back={{ href: "/settings", label: "Cài đặt" }}
      />
      <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
        <RuleList />
      </Suspense>
    </>
  );
}
