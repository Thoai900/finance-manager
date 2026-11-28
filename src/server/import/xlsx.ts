import ExcelJS from "exceljs";

export type SheetRow = { line: number; cells: { col: number; text: string }[] };

/**
 * Đọc sheet đầu tiên thành các dòng chữ. Ô gộp (merged) chỉ lấy ô chính để không lặp giá trị.
 * Sao kê Techcombank để mọi ô dạng chữ (kể cả ngày, số tiền) nên chỉ cần `cell.text`.
 */
export async function readXlsxRows(data: ArrayBuffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, line) => {
    const cells: SheetRow["cells"] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (cell.isMerged && cell.master.address !== cell.address) return;
      const text = cell.text.trim();
      if (text) cells.push({ col, text });
    });
    if (cells.length) rows.push({ line, cells });
  });
  return rows;
}
