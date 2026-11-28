import { notFound } from "next/navigation";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassDialog } from "@/components/glass/glass-dialog";
import { GlassInput } from "@/components/glass/glass-input";
import { StatTile } from "@/components/glass/stat-tile";
import { ThemeToggle } from "@/components/theme-toggle";

// Trang xem thử toàn bộ component kính. Chỉ dùng khi phát triển.
const SAMPLE_ROWS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  date: `${String((i % 28) + 1).padStart(2, "0")}/11/2026`,
  text: i % 3 === 0 ? "Chuyển tiền từ bạn bè" : "Thanh toán quán cà phê",
  amount: (i + 1) * 37_000,
  income: i % 3 === 0,
}));

// Font Geist không có ký tự "₫" nên dùng chữ "đ".
const vnd = { format: (n: number) => `${n.toLocaleString("vi-VN")} đ` };

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bộ giao diện kính</h1>
        <ThemeToggle />
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Tổng số dư"
          value={vnd.format(1_848_396)}
          hint="1 ví"
        />
        <StatTile
          label="Thu tháng này"
          value={vnd.format(19_703_740)}
          tone="income"
        />
        <StatTile
          label="Chi tháng này"
          value={vnd.format(18_428_848)}
          tone="expense"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <GlassCard>
          <h2 className="font-semibold">Kính thường</h2>
          <p className="mt-2 text-fg-muted">
            Dùng cho thẻ, thanh điều hướng. Chữ phụ phải đọc rõ trên nền mờ.
          </p>
        </GlassCard>
        <GlassCard strong>
          <h2 className="font-semibold">Kính đục</h2>
          <p className="mt-2 text-fg-muted">
            Dùng cho bảng, form, vùng nhiều chữ.
          </p>
        </GlassCard>
      </section>

      <GlassCard className="flex flex-col gap-4">
        <h2 className="font-semibold">Nút và ô nhập</h2>
        <div className="flex flex-wrap gap-3">
          <GlassButton variant="primary">Thêm giao dịch</GlassButton>
          <GlassButton>Huỷ</GlassButton>
          <GlassButton disabled>Không khả dụng</GlassButton>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">Số tiền</span>
          <GlassInput inputMode="numeric" placeholder="Ví dụ: 1.250.000" />
        </label>
        <div>
          <GlassDialog
            trigger={<GlassButton>Mở hộp thoại</GlassButton>}
            title="Xoá giao dịch?"
            description="Thao tác này không thể hoàn tác."
          >
            <div className="flex justify-end gap-3">
              <GlassButton>Huỷ</GlassButton>
              <GlassButton variant="primary">Xoá</GlassButton>
            </div>
          </GlassDialog>
        </div>
      </GlassCard>

      <GlassCard strong className="p-0">
        <h2 className="p-5 pb-2 font-semibold">Bảng dài (kiểm tra cuộn)</h2>
        <ul>
          {SAMPLE_ROWS.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 border-t border-glass-border px-5 py-3 text-sm"
            >
              <span>
                <span className="block">{row.text}</span>
                <span className="text-xs text-fg-muted">{row.date}</span>
              </span>
              <span
                className={`font-medium tabular-nums ${row.income ? "text-income" : "text-expense"}`}
              >
                {row.income ? "+" : "−"}
                {vnd.format(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </main>
  );
}
