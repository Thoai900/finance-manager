"use client";

import { useState, useTransition } from "react";
import {
  copyBudgetsFromPreviousMonth,
  setBudget,
} from "@/server/actions/budgets";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassDialog } from "../glass/glass-dialog";
import { GlassInput } from "../glass/glass-input";
import { useActionForm } from "../use-action-form";

type Props = {
  categoryId: string;
  categoryName: string;
  month: string;
  monthLabel: string;
  /** Hạn mức hiện tại đã định dạng ("3.000.000"), hoặc null nếu chưa đặt. */
  amount: string | null;
};

function BudgetForm({ props, onDone }: { props: Props; onDone: () => void }) {
  const { onSubmit, error, pending } = useActionForm(setBudget, onDone);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="categoryId" value={props.categoryId} />
      <input type="hidden" name="month" value={props.month} />
      <FormField label="Hạn mức (đ)">
        <GlassInput
          name="amount"
          inputMode="numeric"
          placeholder="Ví dụ: 3.000.000"
          defaultValue={props.amount ?? ""}
          autoFocus
        />
      </FormField>
      <p className="text-sm text-fg-muted">
        Để trống rồi lưu để bỏ ngân sách của danh mục này.
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

export function BudgetDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      title={`Ngân sách ${props.categoryName}`}
      description={props.monthLabel}
      trigger={
        <GlassButton
          className="h-9"
          aria-label={`${props.amount ? "Sửa" : "Đặt"} ngân sách ${props.categoryName}`}
        >
          {props.amount ? "Sửa" : "Đặt"}
        </GlassButton>
      }
    >
      <BudgetForm props={props} onDone={() => setOpen(false)} />
    </GlassDialog>
  );
}

export function CopyBudgetsButton({ month }: { month: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <GlassButton
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await copyBudgetsFromPreviousMonth(month);
            setError(r.ok ? null : r.error);
          })
        }
      >
        {pending ? "Đang chép…" : "Chép ngân sách tháng trước"}
      </GlassButton>
      <FormError message={error} />
    </div>
  );
}
