// Ngày giờ theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
// Ngày không kèm giờ được lưu là 00:00 giờ Việt Nam của ngày đó.

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-28" → Date lúc 00:00 giờ VN ngày đó. Trả null nếu ngày không có thật. */
export function vnDateToUtc(isoDate: string): Date | null {
  const m = ISO_DATE.exec(isoDate);
  if (!m) return null;
  const date = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  // Loại ngày không có thật như 2026-02-30 (JS tự cộng sang tháng sau).
  return toVnIsoDate(date) === isoDate ? date : null;
}

const isoParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date → "2026-11-28" theo giờ VN (dùng cho ô nhập ngày). */
export function toVnIsoDate(date: Date): string {
  return isoParts.format(date);
}

/** Date → "28/11/2026" theo giờ VN. */
export function formatVnDate(date: Date): string {
  const [y, m, d] = toVnIsoDate(date).split("-");
  return `${d}/${m}/${y}`;
}

/** Hôm nay theo giờ VN, dạng "2026-11-28". */
export function todayVnIso(now = new Date()): string {
  return toVnIsoDate(now);
}

/** Khoảng [from 00:00, ngày sau `to` 00:00) giờ VN, để lọc theo ngày (gồm cả ngày `to`). */
export function vnDateRange(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  const start = from ? vnDateToUtc(from) : null;
  const end = to ? vnDateToUtc(to) : null;
  if (start) range.gte = start;
  if (end) range.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return range;
}

/** "2026-11-28" → "28/11/2026". */
export function isoToDmy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

// ---- Tháng ("2026-11"), theo giờ Việt Nam ----

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  return MONTH.test(month);
}

/** Tháng hiện tại theo giờ VN, "2026-11". */
export function currentVnMonth(now = new Date()): string {
  return toVnIsoDate(now).slice(0, 7);
}

/** Cộng/trừ tháng: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Khoảng [00:00 ngày 1, 00:00 ngày 1 tháng sau) giờ VN. */
export function vnMonthRange(month: string): { gte: Date; lt: Date } {
  return {
    gte: vnDateToUtc(`${month}-01`)!,
    lt: vnDateToUtc(`${shiftMonth(month, 1)}-01`)!,
  };
}

/** "2026-11" → "Tháng 11/2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}
