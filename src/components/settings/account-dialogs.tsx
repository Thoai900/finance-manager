"use client";

import { useState, useTransition } from "react";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount,
} from "@/server/actions/accounts";
import { ConfirmDialog } from "../confirm-dialog";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassDialog } from "../glass/glass-dialog";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import { useActionForm } from "../use-action-form";

/** Dữ liệu ví truyền xuống client; số dư đã định dạng sẵn ("1.250.000"). */
export type AccountFormValues = {
  id: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPE_LABELS;
  initialBalance: string;
  archived: boolean;
};

function AccountForm({
  account,
  onDone,
}: {
  account?: AccountFormValues;
  onDone: () => void;
}) {
  const { onSubmit, error, pending } = useActionForm(
    account ? updateAccount : createAccount,
    onDone,
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <FormField label="Tên ví">
        <GlassInput
          name="name"
          defaultValue={account?.name}
          required
          maxLength={50}
          autoFocus
        />
      </FormField>
      <FormField label="Loại">
        <GlassSelect name="type" defaultValue={account?.type ?? "bank"}>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </GlassSelect>
      </FormField>
      <FormField label="Số dư ban đầu (đ)">
        <GlassInput
          name="initialBalance"
          inputMode="numeric"
          placeholder="Ví dụ: 1.250.000"
          defaultValue={account?.initialBalance ?? ""}
        />
      </FormField>
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

export function AccountFormDialog({
  account,
  trigger,
}: {
  account?: AccountFormValues;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={account ? "Sửa ví" : "Thêm ví"}
    >
      <AccountForm account={account} onDone={() => setOpen(false)} />
    </GlassDialog>
  );
}

export function AccountRowActions({ account }: { account: AccountFormValues }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <AccountFormDialog
          account={account}
          trigger={<GlassButton className="h-9">Sửa</GlassButton>}
        />
        <GlassButton
          className="h-9"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await setAccountArchived(account.id, !account.archived);
              setError(r.ok ? null : r.error);
            })
          }
        >
          {account.archived ? "Khôi phục" : "Lưu trữ"}
        </GlassButton>
        <ConfirmDialog
          trigger={<GlassButton className="h-9">Xoá</GlassButton>}
          title={`Xoá ví "${account.name}"?`}
          description="Chỉ xoá được ví chưa có giao dịch. Thao tác này không thể hoàn tác."
          confirmLabel="Xoá ví"
          onConfirm={() => deleteAccount(account.id)}
        />
      </div>
      <FormError message={error} />
    </div>
  );
}
