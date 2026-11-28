import Link from "next/link";
import type { TxFilters } from "@/server/queries/transactions";
import { FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import type { AccountOption, CategoryOption } from "./transaction-dialog";

/** Bộ lọc dạng form GET: chạy được cả khi chưa tải JavaScript. */
export function TransactionFilters({
  filters,
  accounts,
  categories,
}: {
  filters: TxFilters;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const active =
    filters.from ||
    filters.to ||
    filters.accountId ||
    filters.categoryId ||
    filters.type ||
    filters.source ||
    filters.q;
  return (
    <details open={Boolean(active)} className="glass group mb-4 rounded-2xl">
      <summary className="cursor-pointer list-none px-5 py-3 font-medium">
        Bộ lọc{active ? " (đang lọc)" : ""}
        <span className="ml-2 text-sm text-fg-muted group-open:hidden">
          Bấm để mở
        </span>
      </summary>
      <form className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Từ ngày">
          <GlassInput type="date" name="from" defaultValue={filters.from} />
        </FormField>
        <FormField label="Đến ngày">
          <GlassInput type="date" name="to" defaultValue={filters.to} />
        </FormField>
        <FormField label="Ví">
          <GlassSelect name="account" defaultValue={filters.accountId ?? ""}>
            <option value="">Tất cả</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </GlassSelect>
        </FormField>
        <FormField label="Danh mục">
          <GlassSelect name="category" defaultValue={filters.categoryId ?? ""}>
            <option value="">Tất cả</option>
            {categories.flatMap((c) => [
              <option key={c.id} value={c.id}>
                {c.name}
              </option>,
              ...c.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {c.name} › {child.name}
                </option>
              )),
            ])}
          </GlassSelect>
        </FormField>
        <FormField label="Loại">
          <GlassSelect name="type" defaultValue={filters.type ?? ""}>
            <option value="">Tất cả</option>
            <option value="expense">Chi</option>
            <option value="income">Thu</option>
            <option value="transfer">Chuyển khoản</option>
          </GlassSelect>
        </FormField>
        <FormField label="Nguồn">
          <GlassSelect name="source" defaultValue={filters.source ?? ""}>
            <option value="">Tất cả</option>
            <option value="manual">Nhập tay</option>
            <option value="import">Từ sao kê</option>
          </GlassSelect>
        </FormField>
        <FormField label="Tìm kiếm">
          <GlassInput
            name="q"
            defaultValue={filters.q}
            placeholder="Ghi chú, nội dung, đối tác"
          />
        </FormField>
        <div className="flex items-end gap-3">
          <GlassButton type="submit" variant="primary">
            Lọc
          </GlassButton>
          <Link
            href="/transactions"
            className="px-2 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Xoá lọc
          </Link>
        </div>
      </form>
    </details>
  );
}
