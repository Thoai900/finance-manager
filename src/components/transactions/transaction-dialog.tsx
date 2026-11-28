"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  deleteTransaction,
  createTransaction,
  updateTransaction,
} from "@/server/actions/transactions";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassDialog } from "../glass/glass-dialog";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import { useActionForm } from "../use-action-form";

export type TxType = "expense" | "income" | "transfer";
export type AccountOption = { id: string; name: string; archived: boolean };
export type CategoryOption = {
  id: string;
  name: string;
  kind: "income" | "expense";
  children: { id: string; name: string }[];
};
/** Giá trị đã chuẩn hoá cho form: số tiền "50.000", ngày "2026-11-28". */
export type TransactionFormValues = {
  id: string;
  type: TxType;
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
};

type FormContext = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaultAccountId: string;
  today: string;
};

const TYPE_LABELS: Record<TxType, string> = {
  expense: "Chi",
  income: "Thu",
  transfer: "Chuyển khoản",
};

function AccountSelect({
  name,
  accounts,
  defaultValue,
}: {
  name: string;
  accounts: AccountOption[];
  defaultValue: string;
}) {
  // Ví đã lưu trữ chỉ hiện khi giao dịch đang sửa đang dùng nó.
  const visible = accounts.filter((a) => !a.archived || a.id === defaultValue);
  return (
    <GlassSelect name={name} defaultValue={defaultValue} required>
      <option value="" disabled>
        Chọn ví
      </option>
      {visible.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.archived ? " (đã lưu trữ)" : ""}
        </option>
      ))}
    </GlassSelect>
  );
}

function TransactionForm({
  ctx,
  transaction,
  onDone,
}: {
  ctx: FormContext;
  transaction?: TransactionFormValues;
  onDone: () => void;
}) {
  const { onSubmit, error, pending } = useActionForm(
    transaction ? updateTransaction : createTransaction,
    onDone,
  );
  const [type, setType] = useState<TxType>(transaction?.type ?? "expense");
  const categories =
    type === "transfer" ? [] : ctx.categories.filter((c) => c.kind === type);
  const accountDefault = transaction?.accountId ?? ctx.defaultAccountId;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {transaction ? (
        <input type="hidden" name="id" value={transaction.id} />
      ) : null}
      <fieldset className="glass-strong grid grid-cols-3 gap-1 rounded-xl p-1">
        <legend className="sr-only">Loại giao dịch</legend>
        {(Object.keys(TYPE_LABELS) as TxType[]).map((t) => (
          <label
            key={t}
            className={cn(
              "cursor-pointer rounded-lg py-2 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
              type === t
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {TYPE_LABELS[t]}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Số tiền (đ)">
          <GlassInput
            name="amount"
            inputMode="numeric"
            placeholder="50.000"
            defaultValue={transaction?.amount}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Ngày">
          <GlassInput
            type="date"
            name="date"
            defaultValue={transaction?.date ?? ctx.today}
            required
          />
        </FormField>
      </div>

      <FormField label={type === "transfer" ? "Từ ví" : "Ví"}>
        <AccountSelect
          name="accountId"
          accounts={ctx.accounts}
          defaultValue={accountDefault}
        />
      </FormField>

      {type === "transfer" ? (
        <FormField label="Đến ví">
          <AccountSelect
            name="toAccountId"
            accounts={ctx.accounts}
            defaultValue={transaction?.toAccountId ?? ""}
          />
        </FormField>
      ) : (
        <FormField label="Danh mục">
          {/* key: chọn lại danh mục khi đổi giữa Thu và Chi */}
          <GlassSelect
            key={type}
            name="categoryId"
            defaultValue={
              transaction?.type === type ? (transaction.categoryId ?? "") : ""
            }
            required
          >
            <option value="" disabled>
              Chọn danh mục
            </option>
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
      )}

      <FormField label="Ghi chú">
        <GlassInput
          name="note"
          maxLength={200}
          defaultValue={transaction?.note}
        />
      </FormField>

      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {transaction ? (
          <div className="mr-auto">
            <ConfirmDialog
              trigger={<GlassButton type="button">Xoá</GlassButton>}
              title="Xoá giao dịch?"
              description="Số dư ví sẽ được tính lại. Thao tác này không thể hoàn tác."
              confirmLabel="Xoá giao dịch"
              onConfirm={async () => {
                const r = await deleteTransaction(transaction.id);
                if (r.ok) onDone();
                return r;
              }}
            />
          </div>
        ) : null}
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

export function TransactionFormDialog({
  trigger,
  transaction,
  ...ctx
}: FormContext & {
  trigger: React.ReactNode;
  transaction?: TransactionFormValues;
}) {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={transaction ? "Sửa giao dịch" : "Thêm giao dịch"}
    >
      <TransactionForm
        ctx={ctx}
        transaction={transaction}
        onDone={() => setOpen(false)}
      />
    </GlassDialog>
  );
}
