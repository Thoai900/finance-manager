"use client";

import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { isoToDmy } from "@/lib/dates";
import { importStatement, previewStatement } from "@/server/actions/import";
import type {
  ImportPreview,
  ImportSummary,
  PreviewRow,
} from "@/server/import/types";
import { FormError, FormField } from "../form-field";
import { GlassButton } from "../glass/glass-button";
import { GlassCard } from "../glass/glass-card";
import { GlassInput } from "../glass/glass-input";
import { GlassSelect } from "../glass/glass-select";
import type { CategoryOption } from "../transactions/transaction-dialog";

type Props = {
  accounts: { id: string; name: string }[];
  defaultAccountId: string;
  categories: CategoryOption[];
};

function CategoryOptions({ categories }: { categories: CategoryOption[] }) {
  return categories.flatMap((c) => [
    <option key={c.id} value={c.id}>
      {c.name}
    </option>,
    ...c.children.map((child) => (
      <option key={child.id} value={child.id}>
        {c.name} › {child.name}
      </option>
    )),
  ]);
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div>
      <p className="text-sm text-fg-muted">{label}</p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ImportWizard({
  accounts,
  defaultAccountId,
  categories,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [chosen, setChosen] = useState<Record<string, string | null>>({});
  const [remember, setRemember] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [inputKey, setInputKey] = useState(0);

  const byKind = useMemo(
    () => ({
      income: categories.filter((c) => c.kind === "income"),
      expense: categories.filter((c) => c.kind === "expense"),
    }),
    [categories],
  );

  const categoryOf = (row: PreviewRow) =>
    row.key in chosen ? chosen[row.key] : row.categoryId;
  const newRows = preview?.rows.filter((r) => !r.duplicate) ?? [];
  const uncategorized = newRows.filter((r) => !categoryOf(r)).length;

  function reset() {
    setFile(null);
    setPreview(null);
    setSummary(null);
    setChosen({});
    setRemember({});
    setError(null);
    setInputKey((k) => k + 1);
  }

  function formData() {
    const fd = new FormData();
    fd.set("file", file!);
    fd.set("accountId", accountId);
    return fd;
  }

  function onPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Chọn file sao kê");
    startTransition(async () => {
      const r = await previewStatement(formData());
      if (r.ok) {
        setPreview(r.preview);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  function onImport() {
    const fd = formData();
    fd.set(
      "choices",
      JSON.stringify({
        categories: chosen,
        remember: Object.entries(remember).map(
          ([counterparty, categoryId]) => ({ counterparty, categoryId }),
        ),
      }),
    );
    startTransition(async () => {
      const r = await importStatement(fd);
      if (r.ok) {
        setSummary(r.summary);
        setPreview(null);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  function choose(row: PreviewRow, value: string) {
    const categoryId = value || null;
    const cp = row.counterparty;
    if (cp && cp in remember && categoryId) {
      // Đang ghi nhớ cho đối tác này → áp dụng cho mọi dòng mới của đối tác.
      setRemember({ ...remember, [cp]: categoryId });
      setChosen({
        ...chosen,
        ...Object.fromEntries(
          newRows
            .filter((r) => r.counterparty === cp)
            .map((r) => [r.key, categoryId]),
        ),
      });
    } else {
      setChosen({ ...chosen, [row.key]: categoryId });
    }
  }

  function toggleRemember(row: PreviewRow, on: boolean) {
    const cp = row.counterparty!;
    const categoryId = categoryOf(row);
    if (on && categoryId) {
      setRemember({ ...remember, [cp]: categoryId });
      setChosen({
        ...chosen,
        ...Object.fromEntries(
          newRows
            .filter((r) => r.counterparty === cp)
            .map((r) => [r.key, categoryId]),
        ),
      });
    } else {
      const next = { ...remember };
      delete next[cp];
      setRemember(next);
    }
  }

  if (summary) {
    return (
      <GlassCard className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="size-5 text-income" aria-hidden />
          Đã nhập {summary.imported} giao dịch
          {summary.skipped ? `, bỏ qua ${summary.skipped} đã có` : ""}
        </p>
        {summary.matchesClosing ? (
          <p>
            Số dư ví bây giờ là{" "}
            <strong className="tabular-nums">{summary.balanceAfter}</strong>,
            khớp số dư cuối kỳ trên sao kê.
          </p>
        ) : (
          <p className="flex gap-2">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-expense"
              aria-hidden
            />
            <span>
              Số dư ví là{" "}
              <strong className="tabular-nums">{summary.balanceAfter}</strong>,
              khác số dư cuối kỳ trên sao kê (
              <span className="tabular-nums">{summary.closing}</span>). Có thể
              còn thiếu một kỳ sao kê, hoặc ví có giao dịch nhập tay trùng với
              sao kê.
            </span>
          </p>
        )}
        <div>
          <GlassButton onClick={reset}>Nhập file khác</GlassButton>
        </div>
      </GlassCard>
    );
  }

  if (!preview) {
    return (
      <GlassCard>
        <form onSubmit={onPreview} className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">
            Tải file sao kê Excel (.xlsx) từ Techcombank. File chỉ được đọc để
            nhập giao dịch, không được lưu lại.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ví">
              <GlassSelect
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </GlassSelect>
            </FormField>
            <FormField label="File sao kê (.xlsx)">
              <GlassInput
                key={inputKey}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="pt-2 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1 file:text-accent-fg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </FormField>
          </div>
          <FormError message={error} />
          <div>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={pending || !file}
            >
              <FileUp className="size-4" aria-hidden />
              {pending ? "Đang đọc file…" : "Đọc file"}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">
          {preview.fileName} · ví {preview.accountName} · kỳ{" "}
          {isoToDmy(preview.periodFrom)} – {isoToDmy(preview.periodTo)}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Số dư đầu kỳ" value={preview.opening} />
          <Stat label="Tiền vào" value={preview.totalCredit} tone="income" />
          <Stat label="Tiền ra" value={preview.totalDebit} tone="expense" />
          <Stat label="Số dư cuối kỳ" value={preview.closing} />
        </div>
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-income" aria-hidden />
          File hợp lệ: các dòng cộng lại khớp dòng Cộng doanh số và số dư cuối
          kỳ.
        </p>
        <p className="text-sm">
          <strong>{preview.newCount}</strong> giao dịch mới ·{" "}
          <strong>{preview.duplicateCount}</strong> đã nhập trước đó (bỏ qua) ·{" "}
          <strong>{uncategorized}</strong> chưa phân loại
        </p>
        {preview.setsInitialBalance ? (
          <p className="text-sm text-fg-muted">
            Ví chưa có giao dịch nào: số dư ban đầu sẽ được đặt bằng số dư đầu
            kỳ ({preview.opening}).
          </p>
        ) : null}
        {preview.matchesClosing ? (
          <p className="text-sm">
            Sau khi nhập, số dư ví sẽ là{" "}
            <strong className="tabular-nums">{preview.balanceAfter}</strong>,
            khớp số dư cuối kỳ.
          </p>
        ) : (
          <p className="flex gap-2 text-sm">
            <AlertTriangle
              className="size-4 shrink-0 text-expense"
              aria-hidden
            />
            Sau khi nhập, số dư ví sẽ là{" "}
            <strong className="tabular-nums">{preview.balanceAfter}</strong>,
            khác số dư cuối kỳ ({preview.closing}). Có thể còn thiếu một kỳ sao
            kê trước kỳ này.
          </p>
        )}
      </GlassCard>

      <GlassCard strong className="p-0">
        <ul>
          {preview.rows.map((row, i) => {
            const categoryId = categoryOf(row);
            const showRemember =
              !row.duplicate &&
              row.counterparty &&
              categoryId &&
              (categoryId !== row.categoryId || row.counterparty in remember);
            const sameCount = newRows.filter(
              (r) => r.counterparty === row.counterparty,
            ).length;
            return (
              <li
                key={row.key}
                className={cn(
                  "grid gap-2 px-5 py-3 sm:grid-cols-[1fr_14rem]",
                  i > 0 && "border-t border-glass-border",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-medium">
                      <span className="text-sm font-normal text-fg-muted">
                        {isoToDmy(row.date)} ·{" "}
                      </span>
                      {row.counterparty ?? "Không có đối tác"}
                    </p>
                    <p
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        row.type === "income" ? "text-income" : "text-expense",
                      )}
                    >
                      {row.type === "income" ? "+" : "−"}
                      {row.amount}
                    </p>
                  </div>
                  {row.description ? (
                    <p className="line-clamp-2 text-sm break-words text-fg-muted">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                {row.duplicate ? (
                  <p className="self-center text-sm text-fg-muted">
                    Đã nhập trước đó — bỏ qua
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 self-center">
                    <GlassSelect
                      aria-label={`Danh mục cho giao dịch dòng ${row.line}`}
                      value={categoryId ?? ""}
                      onChange={(e) => choose(row, e.target.value)}
                      className="h-9"
                    >
                      <option value="">Chưa phân loại</option>
                      <CategoryOptions categories={byKind[row.type]} />
                    </GlassSelect>
                    {showRemember ? (
                      <label className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-accent"
                          checked={row.counterparty! in remember}
                          onChange={(e) =>
                            toggleRemember(row, e.target.checked)
                          }
                        />
                        <span>
                          Ghi nhớ cho đối tác này
                          {sameCount > 1
                            ? ` (áp dụng cho ${sameCount} dòng)`
                            : ""}
                        </span>
                      </label>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </GlassCard>

      <FormError message={error} />
      <div className="flex flex-wrap justify-end gap-3">
        <GlassButton onClick={reset} disabled={pending}>
          Huỷ
        </GlassButton>
        <GlassButton
          variant="primary"
          onClick={onImport}
          disabled={pending || preview.newCount === 0}
        >
          {pending ? "Đang nhập…" : `Nhập ${preview.newCount} giao dịch`}
        </GlassButton>
      </div>
    </div>
  );
}
