"use client";

import { useState } from "react";
import { createRule, deleteRule, updateRule } from "@/server/actions/rules";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassDialog } from "../glass/glass-dialog";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import type { CategoryOption } from "../transactions/transaction-dialog";
import { useActionForm } from "../use-action-form";

export type RuleFormValues = {
  id: string;
  field: "counterparty" | "description";
  pattern: string;
  categoryId: string;
  priority: number;
};

const KIND_GROUP = { expense: "Khoản chi", income: "Khoản thu" } as const;

function RuleForm({
  rule,
  categories,
  onDone,
}: {
  rule?: RuleFormValues;
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const { onSubmit, error, pending } = useActionForm(
    rule ? updateRule : createRule,
    onDone,
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      <FormField label="Khi cột">
        <GlassSelect name="field" defaultValue={rule?.field ?? "counterparty"}>
          <option value="counterparty">Đối tác</option>
          <option value="description">Nội dung (Diễn giải)</option>
        </GlassSelect>
      </FormField>
      <FormField label="có chứa (không phân biệt dấu, hoa thường)">
        <GlassInput
          name="pattern"
          defaultValue={rule?.pattern}
          required
          maxLength={100}
          autoFocus
        />
      </FormField>
      <FormField label="thì xếp vào danh mục">
        <GlassSelect
          name="categoryId"
          defaultValue={rule?.categoryId ?? ""}
          required
        >
          <option value="" disabled>
            Chọn danh mục
          </option>
          {(["expense", "income"] as const).map((kind) => (
            <optgroup key={kind} label={KIND_GROUP[kind]}>
              {categories
                .filter((c) => c.kind === kind)
                .flatMap((c) => [
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>,
                  ...c.children.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {c.name} › {ch.name}
                    </option>
                  )),
                ])}
            </optgroup>
          ))}
        </GlassSelect>
      </FormField>
      <FormField label="Độ ưu tiên (số lớn được xét trước)">
        <GlassInput
          name="priority"
          type="number"
          min={-100}
          max={100}
          defaultValue={rule?.priority ?? 0}
        />
      </FormField>
      <p className="text-sm text-fg-muted">
        Quy tắc chỉ áp cho giao dịch cùng loại với danh mục (khoản chi hoặc
        khoản thu).
      </p>
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

export function RuleFormDialog({
  rule,
  categories,
  trigger,
}: {
  rule?: RuleFormValues;
  categories: CategoryOption[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={rule ? "Sửa quy tắc" : "Thêm quy tắc"}
    >
      <RuleForm
        rule={rule}
        categories={categories}
        onDone={() => setOpen(false)}
      />
    </GlassDialog>
  );
}

export function RuleRowActions({
  rule,
  categories,
}: {
  rule: RuleFormValues;
  categories: CategoryOption[];
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <RuleFormDialog
        rule={rule}
        categories={categories}
        trigger={<GlassButton className="h-9">Sửa</GlassButton>}
      />
      <ConfirmDialog
        trigger={<GlassButton className="h-9">Xoá</GlassButton>}
        title="Xoá quy tắc?"
        description="Giao dịch đã nhập không bị đổi danh mục."
        confirmLabel="Xoá quy tắc"
        onConfirm={() => deleteRule(rule.id)}
      />
    </div>
  );
}
