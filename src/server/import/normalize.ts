import { createHash } from "node:crypto";
import { buildSearchText, normalizeVn } from "@/lib/vn-text";
import { dmyToIso, type StatementRow } from "./techcombank";

export type ImportRow = {
  line: number;
  /** Khoá chống trùng: Số bút toán, hoặc hash nếu dòng không có Số bút toán. */
  importKey: string;
  type: "income" | "expense";
  amount: bigint;
  /** Ngày giao dịch dùng trong app, "2026-11-08". */
  date: string;
  counterparty: string | null;
  counterpartyBank: string | null;
  rawDescription: string | null;
  searchText: string | null;
};

const NGAY = /NGAY (\d{2}\/\d{2}\/\d{4})/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ngày thực tế: Techcombank ghi "Ngày giao dịch" là ngày làm việc kế tiếp, nhưng thanh toán thẻ/ví
 * thường có "NGAY dd/mm/yyyy" trong Diễn giải. Chỉ dùng ngày đó nếu nằm trong 7 ngày trước ngày sao kê.
 */
export function actualDate(
  row: Pick<StatementRow, "date" | "description">,
): string {
  const m = row.description ? NGAY.exec(row.description) : null;
  const candidate = m ? dmyToIso(m[1]) : null;
  if (!candidate) return row.date;
  const diff = Date.parse(row.date) - Date.parse(candidate);
  return diff >= 0 && diff <= 7 * DAY_MS ? candidate : row.date;
}

export function toImportRows(rows: StatementRow[]): ImportRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const type = row.credit > 0n ? "income" : "expense";
    const amount = type === "income" ? row.credit : row.debit;
    let importKey = row.ref?.trim();
    if (!importKey) {
      // Không có Số bút toán (ví dụ trả lãi): hash nội dung + số thứ tự nếu trùng y hệt trong file.
      const base = [
        row.date,
        type,
        amount,
        normalizeVn(row.description ?? ""),
        normalizeVn(row.counterparty ?? ""),
      ].join("|");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      importKey =
        "h:" +
        createHash("sha256").update(`${base}|${n}`).digest("hex").slice(0, 32);
    }
    return {
      line: row.line,
      importKey,
      type,
      amount,
      date: actualDate(row),
      counterparty: row.counterparty,
      counterpartyBank: row.counterpartyBank,
      rawDescription: row.description,
      searchText: buildSearchText(row.description, row.counterparty),
    };
  });
}
