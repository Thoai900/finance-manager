import { describe, expect, test } from "vitest";
import {
  formatVnDate,
  todayVnIso,
  toVnIsoDate,
  vnDateRange,
  vnDateToUtc,
} from "@/lib/dates";

describe("vnDateToUtc", () => {
  test("00:00 giờ VN = 17:00 UTC ngày hôm trước", () => {
    expect(vnDateToUtc("2026-11-01")?.toISOString()).toBe(
      "2026-10-31T17:00:00.000Z",
    );
  });

  test.each(["", "28/11/2026", "2026-13-01", "2026-02-30", "2026-11-1", "abc"])(
    "%j không hợp lệ",
    (input) => {
      expect(vnDateToUtc(input)).toBeNull();
    },
  );

  test("29/02 năm nhuận hợp lệ", () => {
    expect(vnDateToUtc("2028-02-29")).not.toBeNull();
  });
});

describe("hiển thị theo giờ VN", () => {
  // 23:30 ngày 31/10 giờ VN = 16:30 UTC 31/10; 00:30 ngày 1/11 giờ VN = 17:30 UTC 31/10.
  const lateOct = new Date("2026-10-31T16:30:00Z");
  const earlyNov = new Date("2026-10-31T17:30:00Z");

  test("giao dịch 23:30 ngày cuối tháng vẫn thuộc tháng đó", () => {
    expect(toVnIsoDate(lateOct)).toBe("2026-10-31");
    expect(formatVnDate(lateOct)).toBe("31/10/2026");
  });

  test("00:30 sáng 1/11 giờ VN thuộc tháng 11 dù UTC vẫn là 31/10", () => {
    expect(toVnIsoDate(earlyNov)).toBe("2026-11-01");
  });

  test("hôm nay theo giờ VN", () => {
    expect(todayVnIso(new Date("2026-11-27T18:00:00Z"))).toBe("2026-11-28");
  });

  test("format rồi đọc lại đúng ngày", () => {
    const d = vnDateToUtc("2026-11-28")!;
    expect(toVnIsoDate(d)).toBe("2026-11-28");
  });
});

describe("vnDateRange", () => {
  test("bao gồm trọn ngày cuối", () => {
    const r = vnDateRange("2026-11-01", "2026-11-30");
    expect(r.gte?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(r.lt?.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });

  test("bỏ qua giá trị trống hoặc sai", () => {
    expect(vnDateRange(undefined, "xx")).toEqual({});
  });
});
