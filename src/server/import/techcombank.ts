// Bộ đọc sao kê Techcombank (.xlsx) — cấu trúc xem PLAN.md mục 4.
import { parseVnd } from "@/lib/money";
import type { SheetRow } from "./xlsx";

export class StatementError extends Error {}

export type StatementRow = {
  line: number;
  /** Ngày giao dịch theo sao kê, "2026-10-29". */
  date: string;
  counterparty: string | null;
  counterpartyBank: string | null;
  description: string | null;
  ref: string | null;
  debit: bigint;
  credit: bigint;
  balance: bigint | null;
};

export type ParsedStatement = {
  periodFrom: string;
  periodTo: string;
  opening: bigint;
  closing: bigint;
  totalDebit: bigint;
  totalCredit: bigint;
  rows: StatementRow[];
};

const COLUMNS = {
  date: "ngày giao dịch",
  counterparty: "đối tác",
  counterpartyBank: "nh đối tác",
  description: "diễn giải",
  ref: "số bút toán",
  debit: "nợ tktt",
  credit: "có tktt",
  balance: "số dư",
} as const;
type ColumnKey = keyof typeof COLUMNS;

const lower = (s: string) => s.toLowerCase();
const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** "29/10/2026" → "2026-10-29"; null nếu sai. */
export function dmyToIso(text: string): string | null {
  const m = DMY.exec(text.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso)
    ? iso
    : null;
}

function amount(text: string | undefined, line: number): bigint {
  if (!text) return 0n;
  const v = parseVnd(text);
  if (v === null)
    throw new StatementError(`Dòng ${line}: số tiền "${text}" không đọc được`);
  return v;
}

const startsWith = (row: SheetRow, prefix: string) =>
  row.cells.some((c) => lower(c.text).startsWith(prefix));

/** Giá trị nằm sau ô có nhãn (ví dụ "Từ ngày/ From:" → "29/10/2026"). */
function valueAfter(row: SheetRow, prefix: string): string | undefined {
  const i = row.cells.findIndex((c) => lower(c.text).startsWith(prefix));
  return i >= 0 ? row.cells[i + 1]?.text : undefined;
}

/** Ô số tiền cuối cùng trong dòng (dòng đầu kỳ/cuối kỳ chỉ có một số, vị trí cột không cố định). */
function lastAmount(row: SheetRow): bigint | null {
  for (let i = row.cells.length - 1; i >= 0; i--) {
    const v = parseVnd(row.cells[i].text);
    if (v !== null) return v;
  }
  return null;
}

export function parseTechcombank(sheet: SheetRow[]): ParsedStatement {
  const headerIndex = sheet.findIndex(
    (r) => startsWith(r, COLUMNS.date) && startsWith(r, COLUMNS.ref),
  );
  if (headerIndex < 0) {
    throw new StatementError(
      "Không tìm thấy bảng giao dịch. Hãy chọn file sao kê Excel (.xlsx) tải từ Techcombank.",
    );
  }

  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  for (const row of sheet.slice(0, headerIndex)) {
    periodFrom ??= dmyToIso(valueAfter(row, "từ ngày") ?? "");
    periodTo ??= dmyToIso(valueAfter(row, "đến ngày") ?? "");
  }
  if (!periodFrom || !periodTo)
    throw new StatementError("Không đọc được kỳ sao kê (Từ ngày / Đến ngày)");

  // Vị trí cột theo chữ ở dòng tiêu đề. "nh đối tác" phải xét trước "đối tác".
  const columns = new Map<ColumnKey, number>();
  const order: ColumnKey[] = [
    "counterpartyBank",
    "date",
    "counterparty",
    "description",
    "ref",
    "debit",
    "credit",
    "balance",
  ];
  for (const cell of sheet[headerIndex].cells) {
    const text = lower(cell.text);
    const key = order.find(
      (k) => text.startsWith(COLUMNS[k]) && !columns.has(k),
    );
    if (key) columns.set(key, cell.col);
  }
  const missing = order.filter((k) => !columns.has(k));
  if (missing.length)
    throw new StatementError(
      "Bảng giao dịch thiếu cột: " + missing.map((k) => COLUMNS[k]).join(", "),
    );

  const get = (row: SheetRow, key: ColumnKey) =>
    row.cells.find((c) => c.col === columns.get(key))?.text;

  let opening: bigint | null = null;
  let closing: bigint | null = null;
  let totals: { debit: bigint; credit: bigint } | null = null;
  const rows: StatementRow[] = [];

  for (const row of sheet.slice(headerIndex + 1)) {
    if (startsWith(row, "số dư đầu kỳ")) {
      opening = lastAmount(row);
    } else if (startsWith(row, "cộng doanh số")) {
      totals = {
        debit: amount(get(row, "debit"), row.line),
        credit: amount(get(row, "credit"), row.line),
      };
    } else if (startsWith(row, "số dư cuối kỳ")) {
      closing = lastAmount(row);
      break; // phần sau (chú thích, phụ lục Sinh lời) không phải giao dịch
    } else {
      const date = dmyToIso(get(row, "date") ?? "");
      if (!date) continue; // dòng trống/chú thích; nếu bỏ sót giao dịch thì bước đối chiếu sẽ báo
      const debit = amount(get(row, "debit"), row.line);
      const credit = amount(get(row, "credit"), row.line);
      if (debit > 0n === credit > 0n || debit < 0n || credit < 0n) {
        throw new StatementError(
          `Dòng ${row.line}: mỗi giao dịch phải có đúng một trong hai cột Nợ hoặc Có`,
        );
      }
      const balanceText = get(row, "balance");
      rows.push({
        line: row.line,
        date,
        counterparty: get(row, "counterparty") ?? null,
        counterpartyBank: get(row, "counterpartyBank") ?? null,
        description: get(row, "description") ?? null,
        ref: get(row, "ref") ?? null,
        debit,
        credit,
        balance: balanceText ? amount(balanceText, row.line) : null,
      });
    }
  }

  if (opening === null)
    throw new StatementError("Không tìm thấy dòng Số dư đầu kỳ");
  if (!totals) throw new StatementError("Không tìm thấy dòng Cộng doanh số");
  if (closing === null)
    throw new StatementError("Không tìm thấy dòng Số dư cuối kỳ");

  // Đối chiếu bắt buộc: sai ở bất kỳ bước nào nghĩa là file đọc chưa đúng → không cho nhập.
  const sumDebit = rows.reduce((s, r) => s + r.debit, 0n);
  const sumCredit = rows.reduce((s, r) => s + r.credit, 0n);
  if (sumDebit !== totals.debit || sumCredit !== totals.credit) {
    throw new StatementError(
      "Tổng Nợ/Có của các dòng đọc được không khớp dòng Cộng doanh số",
    );
  }
  if (opening + sumCredit - sumDebit !== closing) {
    throw new StatementError(
      "Số dư đầu kỳ + tổng Có − tổng Nợ không bằng Số dư cuối kỳ",
    );
  }
  let running = opening;
  for (const r of rows) {
    running += r.credit - r.debit;
    if (r.balance !== null && r.balance !== running) {
      throw new StatementError(
        `Dòng ${r.line}: số dư không khớp với các dòng trước`,
      );
    }
  }

  return {
    periodFrom,
    periodTo,
    opening,
    closing,
    totalDebit: sumDebit,
    totalCredit: sumCredit,
    rows,
  };
}
