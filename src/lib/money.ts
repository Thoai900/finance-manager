// Tiền VND lưu dạng bigint (đơn vị đồng). Không dùng số thực.

const groupFormatter = new Intl.NumberFormat("vi-VN");

/** 1250000n → "1.250.000 đ" (font Geist không có ký tự "₫" nên dùng "đ"). */
export function formatVnd(amount: bigint | number): string {
  const value = typeof amount === "bigint" ? amount : BigInt(amount);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${groupFormatter.format(abs)} đ`;
}

/** Chỉ nhóm nghìn, không có ký hiệu tiền: 1250000n → "1.250.000". Dùng làm giá trị sẵn trong ô nhập. */
export function formatVndPlain(amount: bigint): string {
  const sign = amount < 0n ? "-" : "";
  return sign + groupFormatter.format(amount < 0n ? -amount : amount);
}

const PLAIN = /^\d+$/;
const DOT_GROUPED = /^\d{1,3}(\.\d{3})+$/;
const COMMA_GROUPED = /^\d{1,3}(,\d{3})+$/;

/**
 * Đọc số tiền người dùng gõ hoặc từ sao kê. Nhận:
 * "1250000", "1.250.000", "1,250,000", "1 250 000", có thể kèm "đ", "₫", "VND", dấu "-" hoặc "(...)" cho số âm.
 * Trả về null nếu không hợp lệ (VND không có phần thập phân, nên "1.5" hay "1,25" là không hợp lệ).
 */
export function parseVnd(input: string): bigint | null {
  let s = input.trim().replace(/\s+/g, "");
  s = s.replace(/(đ|₫|vnd|vnđ)$/i, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  } else if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!PLAIN.test(s) && !DOT_GROUPED.test(s) && !COMMA_GROUPED.test(s))
    return null;
  const value = BigInt(s.replace(/[.,]/g, ""));
  return negative ? -value : value;
}
