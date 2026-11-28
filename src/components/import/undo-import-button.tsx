"use client";

import { undoImport } from "@/server/actions/import";
import { ConfirmDialog } from "../confirm-dialog";
import { GlassButton } from "../glass/glass-button";

export function UndoImportButton({
  batchId,
  count,
}: {
  batchId: string;
  count: number;
}) {
  return (
    <ConfirmDialog
      trigger={<GlassButton className="h-9">Hoàn tác</GlassButton>}
      title="Hoàn tác lần nhập này?"
      description={`Xoá ${count} giao dịch của lần nhập này (kể cả danh mục, ghi chú đã sửa sau đó). Số dư ví được tính lại.`}
      confirmLabel="Hoàn tác"
      onConfirm={() => undoImport(batchId)}
    />
  );
}
