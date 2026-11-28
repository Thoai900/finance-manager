"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/result";
import { FormError } from "./form-field";
import { GlassButton } from "./glass/glass-button";
import { GlassDialog } from "./glass/glass-dialog";

type ConfirmDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<ActionResult>;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <GlassDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      trigger={trigger}
      title={title}
      description={description}
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <div className="flex justify-end gap-3">
          <GlassButton type="button" onClick={() => setOpen(false)}>
            Huỷ
          </GlassButton>
          <GlassButton
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                if (result.ok) setOpen(false);
                else setError(result.error);
              })
            }
          >
            {pending ? "Đang xử lý…" : confirmLabel}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
