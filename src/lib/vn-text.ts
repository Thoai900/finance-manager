/** Chuẩn hoá chữ tiếng Việt để so khớp/tìm kiếm: bỏ dấu, "đ" → "d", chữ thường, gộp khoảng trắng. */
export function normalizeVn(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuỗi tìm kiếm của một giao dịch, từ ghi chú + nội dung sao kê + đối tác. */
export function buildSearchText(
  ...parts: (string | null | undefined)[]
): string | null {
  const text = normalizeVn(parts.filter(Boolean).join(" "));
  return text || null;
}
