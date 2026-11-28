import { Plus } from "lucide-react";
import { Suspense } from "react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { PageHeader } from "@/components/page-header";
import {
  CategoryFormDialog,
  CategoryRowActions,
  type CategoryFormValues,
  type ParentOption,
} from "@/components/settings/category-dialogs";
import type { Category } from "@/generated/prisma/client";
import {
  type CategoryNode,
  listCategoryTree,
} from "@/server/queries/categories";

const toFormValues = (
  c: Category,
  hasChildren: boolean,
): CategoryFormValues => ({
  id: c.id,
  name: c.name,
  kind: c.kind,
  parentId: c.parentId,
  excludeFromReports: c.excludeFromReports,
  hasChildren,
});

function CategoryRow({
  category,
  hasChildren,
  parents,
  child,
}: {
  category: Category;
  hasChildren: boolean;
  parents: ParentOption[];
  child?: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 border-t border-glass-border py-3 pr-5 ${child ? "pl-10" : "pl-5"}`}
    >
      <div className="min-w-0">
        <p className={child ? "text-sm" : "font-medium"}>{category.name}</p>
        {category.excludeFromReports ? (
          <p className="text-xs text-fg-muted">Không tính vào thống kê</p>
        ) : null}
      </div>
      <CategoryRowActions
        category={toFormValues(category, hasChildren)}
        parents={parents}
      />
    </li>
  );
}

function CategorySection({
  title,
  tree,
  parents,
}: {
  title: string;
  tree: CategoryNode[];
  parents: ParentOption[];
}) {
  return (
    <GlassCard strong className="p-0">
      <h2 className="px-5 py-3 font-semibold">{title}</h2>
      {tree.length === 0 ? (
        <p className="border-t border-glass-border px-5 py-3 text-fg-muted">
          Chưa có danh mục.
        </p>
      ) : (
        <ul>
          {tree.map((root) => [
            <CategoryRow
              key={root.id}
              category={root}
              hasChildren={root.children.length > 0}
              parents={parents}
            />,
            ...root.children.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                hasChildren={false}
                parents={parents}
                child
              />
            )),
          ])}
        </ul>
      )}
    </GlassCard>
  );
}

async function CategoryContent() {
  const tree = await listCategoryTree();
  const parents: ParentOption[] = tree.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));
  return (
    <>
      <div className="mb-4 flex justify-end">
        <CategoryFormDialog
          parents={parents}
          trigger={
            <GlassButton variant="primary">
              <Plus className="size-4" aria-hidden />
              Thêm danh mục
            </GlassButton>
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategorySection
          title="Khoản chi"
          tree={tree.filter((c) => c.kind === "expense")}
          parents={parents}
        />
        <CategorySection
          title="Khoản thu"
          tree={tree.filter((c) => c.kind === "income")}
          parents={parents}
        />
      </div>
    </>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Danh mục"
        back={{ href: "/settings", label: "Cài đặt" }}
      />
      <Suspense fallback={<p className="text-fg-muted">Đang tải…</p>}>
        <CategoryContent />
      </Suspense>
    </>
  );
}
