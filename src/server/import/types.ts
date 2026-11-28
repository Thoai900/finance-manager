/** Dữ liệu xem trước gửi về trình duyệt (chỉ chuỗi/số thường, không bigint). */
export type PreviewRow = {
  key: string;
  line: number;
  /** "2026-11-08" */
  date: string;
  counterparty: string | null;
  description: string | null;
  type: "income" | "expense";
  /** "1.250.000 đ" */
  amount: string;
  duplicate: boolean;
  categoryId: string | null;
};

export type ImportPreview = {
  fileName: string;
  accountId: string;
  accountName: string;
  periodFrom: string;
  periodTo: string;
  opening: string;
  closing: string;
  totalDebit: string;
  totalCredit: string;
  newCount: number;
  duplicateCount: number;
  setsInitialBalance: boolean;
  balanceBefore: string;
  balanceAfter: string;
  matchesClosing: boolean;
  rows: PreviewRow[];
};

export type PreviewResult =
  { ok: true; preview: ImportPreview } | { ok: false; error: string };

export type ImportSummary = {
  imported: number;
  skipped: number;
  balanceAfter: string;
  closing: string;
  matchesClosing: boolean;
};

export type ImportResult =
  { ok: true; summary: ImportSummary } | { ok: false; error: string };
