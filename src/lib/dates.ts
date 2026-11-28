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
