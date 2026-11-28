"use client";

import { useState } from "react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/server/actions/categories";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassDialog } from "../glass/glass-dialog";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import { useActionForm } from "../use-action-form";

export type CategoryKind = "income" | "expense";

export type CategoryFormValues = {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  excludeFromReports: boolean;
  hasChildren: boolean;
};

/** Danh mục gốc, dùng làm lựa chọn "danh mục cha". */
export type ParentOption = { id: string; name: string; kind: CategoryKind };

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Khoản chi",
  income: "Khoản thu",
};

function CategoryForm({
  category,
  parents,
  onDone,
}: {
  category?: CategoryFormValues;
  parents: ParentOption[];
  onDone: () => void;
}) {
  const { onSubmit, error, pending } = useActionForm(
    category ? updateCategory : createCategory,
    onDone,
  );
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "expense");
  const parentOptions = parents.filter(
    (p) => p.kind === kind && p.id !== category?.id,
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <FormField label="Tên danh mục">
        <GlassInput
          name="name"
          defaultValue={category?.name}
          required
          maxLength={50}
          autoFocus
        />
      </FormField>
      {category ? (
        <p className="text-sm text-fg-muted">
          Loại: {KIND_LABELS[category.kind]} (không đổi được)
        </p>
      ) : (
        <FormField label="Loại">
          <GlassSelect
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as CategoryKind)}
          >
            <option value="expense">{KIND_LABELS.expense}</option>
            <option value="income">{KIND_LABELS.income}</option>
          </GlassSelect>
        </FormField>
      )}
      {category?.hasChildren ? (
        <p className="text-sm text-fg-muted">
          Danh mục này có danh mục con nên luôn là danh mục gốc.
        </p>
      ) : (
        <FormField label="Danh mục cha">
          <GlassSelect
            name="parentId"
            key={kind}
            defaultValue={category?.parentId ?? ""}
          >
            <option value="">Không có (danh mục gốc)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </GlassSelect>
        </FormField>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="excludeFromReports"
          defaultChecked={category?.excludeFromReports}
          className="mt-0.5 size-4 accent-accent"
        />
        <span>
          Không tính vào thống kê thu chi và ngân sách
          <span className="block text-fg-muted">
            Ví dụ: chuyển tiền sang tài khoản khác của chính bạn.
          </span>
        </span>
      </label>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <GlassButton type="button" onClick={onDone}>
          Huỷ
        </GlassButton>
        <GlassButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </GlassButton>
      </div>
    </form>
  );
}

export function CategoryFormDialog({
  category,
  parents,
  trigger,
}: {
  category?: CategoryFormValues;
  parents: ParentOption[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={category ? "Sửa danh mục" : "Thêm danh mục"}
    >
      <CategoryForm
        category={category}
        parents={parents}
        onDone={() => setOpen(false)}
      />
    </GlassDialog>
  );
}

export function CategoryRowActions({
  category,
  parents,
}: {
  category: CategoryFormValues;
  parents: ParentOption[];
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <CategoryFormDialog
        category={category}
        parents={parents}
        trigger={<GlassButton className="h-9">Sửa</GlassButton>}
      />
      <ConfirmDialog
        trigger={<GlassButton className="h-9">Xoá</GlassButton>}
        title={`Xoá danh mục "${category.name}"?`}
        description="Ngân sách và quy tắc phân loại của danh mục này cũng bị xoá. Không xoá được nếu danh mục đang có giao dịch."
        confirmLabel="Xoá danh mục"
        onConfirm={() => deleteCategory(category.id)}
      />
    </div>
  );
}
