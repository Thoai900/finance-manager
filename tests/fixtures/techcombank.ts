// Tạo file sao kê Techcombank GIẢ có cùng cấu trúc với file thật (PLAN.md mục 4):
// nhiều ô gộp, mọi ô là chữ, dòng trống xen giữa, dòng đầu kỳ/cuối kỳ, chú thích và phụ lục "Sinh lời".
// Không chứa dữ liệu thật.
import ExcelJS from "exceljs";

export type FakeRow = {
  date: string; // dd/mm/yyyy
  counterparty?: string;
  bank?: string;
  description?: string;
  ref?: string;
  debit?: number;
  credit?: number;
};

const fmt = (n: number) => n.toLocaleString("en-US"); // Techcombank dùng dấu phẩy

// Cột bắt đầu của bảng chính (giống file thật): B, H, Q, Y, AG, AT, BB, BH
const MAIN = {
  date: 2,
  cp: 8,
  bank: 17,
  desc: 25,
  ref: 33,
  debit: 46,
  credit: 54,
  balance: 60,
};
const MAIN_END = {
  date: 7,
  cp: 16,
  bank: 24,
  desc: 32,
  ref: 45,
  debit: 53,
  credit: 59,
  balance: 66,
};

export async function buildStatementXlsx(opts: {
  from: string;
  to: string;
  opening: number;
  rows: FakeRow[];
  /** Ghi đè dòng Cộng doanh số / Số dư cuối kỳ để thử trường hợp sai. */
  totals?: { debit: number; credit: number };
  closing?: number;
  withAppendix?: boolean;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("AccountStatement_A4_Landscape");
  const put = (
    r: number,
    c: number,
    cEnd: number,
    text: string,
    rich = false,
  ) => {
    if (cEnd > c) ws.mergeCells(r, c, r, cEnd);
    ws.getCell(r, c).value = rich ? { richText: [{ text }] } : text;
  };

  put(2, 2, 30, "NGÂN HÀNG TMCP KỸ THƯƠNG VIỆT NAM");
  put(10, 20, 40, "SỔ PHỤ KIÊM PHIẾU BÁO NỢ/ CÓ");
  put(14, 26, 29, "Từ ngày/ From: ");
  put(14, 30, 34, opts.from);
  put(14, 35, 44, " Đến ngày/ To: ");
  put(14, 45, 50, opts.to);
  put(18, 10, 20, "Tên khách hàng/ Customer name:");
  put(18, 21, 40, "NGUOI DUNG GIA");

  const header: [keyof typeof MAIN, string][] = [
    ["date", "Ngày giao dịch (1)\nTransaction Date"],
    ["cp", "Đối tác\nRemitter"],
    ["bank", "NH Đối tác\nRemitter Bank"],
    ["desc", "Diễn giải\nDetails"],
    ["ref", "Số bút toán\nTransaction No"],
    ["debit", "Nợ TKTT\nDebit"],
    ["credit", "Có TKTT\nCredit"],
    ["balance", "Số dư (2)\nBalance"],
  ];
  let r = 34;
  for (const [k, text] of header) put(r, MAIN[k], MAIN_END[k], text, true);
  r++;
  put(r, 2, 59, "Số dư đầu kỳ/ Opening balance");
  put(r, 60, 66, fmt(opts.opening));

  let balance = opts.opening;
  let debit = 0;
  let credit = 0;
  for (const row of opts.rows) {
    r += 2; // dòng trống xen giữa như bản in
    balance += (row.credit ?? 0) - (row.debit ?? 0);
    debit += row.debit ?? 0;
    credit += row.credit ?? 0;
    put(r, MAIN.date, MAIN_END.date, row.date, true);
    if (row.counterparty) put(r, MAIN.cp, MAIN_END.cp, row.counterparty, true);
    if (row.bank) put(r, MAIN.bank, MAIN_END.bank, row.bank, true);
    if (row.description)
      put(r, MAIN.desc, MAIN_END.desc, row.description, true);
    if (row.ref) put(r, MAIN.ref, MAIN_END.ref, row.ref, true);
    if (row.debit) put(r, MAIN.debit, MAIN_END.debit, fmt(row.debit), true);
    if (row.credit) put(r, MAIN.credit, MAIN_END.credit, fmt(row.credit), true);
    put(r, MAIN.balance, MAIN_END.balance, fmt(balance), true);
  }
  r += 2;
  const totals = opts.totals ?? { debit, credit };
  put(r, 2, 45, "Cộng doanh số/Total volume");
  put(r, MAIN.debit, MAIN_END.debit, fmt(totals.debit));
  put(r, MAIN.credit, MAIN_END.credit, fmt(totals.credit));
  r++;
  put(r, 2, 45, "Số dư cuối kỳ/ Ending balance");
  put(r, 46, 66, fmt(opts.closing ?? balance));
  put(
    r + 5,
    2,
    66,
    "(1): Ngày giao dịch: Là ngày làm việc tiếp theo sau ngày phát sinh giao dịch thực tế",
  );

  if (opts.withAppendix) {
    // Phụ lục Sinh lời: cột khác vị trí, số âm trong ngoặc — phải bị bỏ qua.
    const a = r + 20;
    put(a, 5, 20, "Phụ lục/ Appendix (*)");
    put(a + 4, 24, 27, "Từ ngày/ From: ");
    put(a + 4, 28, 31, opts.from);
    const cols = [2, 10, 18, 28, 40, 49, 59];
    const texts = [
      "Ngày giao dịch (1)\nTransaction Date",
      "Đối tác\nRemitter",
      "NH Đối tác\nRemitter Bank",
      "Diễn giải\nDetails",
      "Số bút toán\nTransaction No",
      "Biến động TKTT\nAccount Balance Update",
      "Giá trị CCTG phân bổ (2)",
    ];
    cols.forEach((c, i) => put(a + 8, c, c + 5, texts[i]));
    put(a + 9, 2, 7, opts.to);
    put(a + 9, 28, 35, "Thanh toan giao dich CCTG");
    put(a + 9, 40, 45, "FT_APPENDIX_1");
    put(a + 9, 49, 55, "(3,215,328)");
    put(a + 9, 59, 64, "3,215,328");
  }

  const out = await wb.xlsx.writeBuffer();
  return out as unknown as ArrayBuffer;
}
