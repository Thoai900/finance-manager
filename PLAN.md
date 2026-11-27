# Kế hoạch xây dựng Web App Quản lý Tài chính Cá nhân

## 0. Giả định (cần xác nhận trước khi code)

- Đây là app **tài chính cá nhân**, không phải phần mềm kế toán doanh nghiệp.
- Mỗi người dùng có tài khoản riêng và chỉ thấy dữ liệu của mình (chưa có ví chung gia đình).
- Tiền tệ chính là **VND**. Đa tiền tệ để sau MVP.
- Web responsive, dùng tốt trên điện thoại. Không làm app native.
- Một lập trình viên, triển khai lên cloud chi phí thấp (gói miễn phí nếu được).
- Nhập giao dịch thủ công. Không kết nối API ngân hàng ở MVP.

---

## 1. Phạm vi MVP

### Có trong MVP

1. **Đăng nhập / đăng ký** (Google OAuth).
2. **Ví / tài khoản**: tiền mặt, ngân hàng, thẻ tín dụng, ví điện tử. Mỗi ví có số dư ban đầu.
3. **Giao dịch**: thu, chi, chuyển khoản giữa các ví. Gồm số tiền, ngày, danh mục, ghi chú.
4. **Danh mục**: bộ danh mục mặc định (Ăn uống, Đi lại, Nhà ở, Lương…) + người dùng tự thêm/sửa. Tối đa 2 cấp (cha/con).
5. **Ngân sách tháng** theo danh mục, hiển thị % đã dùng và cảnh báo khi vượt.
6. **Dashboard**: tổng số dư, thu/chi tháng này, biểu đồ chi theo danh mục, xu hướng 6 tháng.
7. **Lọc & tìm kiếm** giao dịch (theo khoảng ngày, ví, danh mục, từ khóa).
8. **Xuất CSV** danh sách giao dịch.

### Không có trong MVP (để giai đoạn sau)

- Giao dịch định kỳ, nhập CSV/sao kê ngân hàng, đa tiền tệ, mục tiêu tiết kiệm, đầu tư, ví chung, quét hóa đơn (OCR), thông báo email/push.

---

## 2. Công nghệ đề xuất

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Frontend + backend trong một repo, Server Actions giảm code API |
| UI | **Tailwind CSS + shadcn/ui** | Component có sẵn (form, table, dialog), dễ làm responsive |
| Biểu đồ | **Recharts** | Đơn giản, đủ cho pie/bar/line |
| Database | **PostgreSQL** (Neon hoặc Supabase) | Quan hệ rõ ràng, có gói miễn phí |
| ORM | **Prisma** | Schema + migration dễ đọc, type-safe |
| Auth | **Auth.js (NextAuth v5)** | Tích hợp Google OAuth nhanh, lưu session vào DB |
| Validation | **Zod** | Dùng chung schema cho form và server |
| Test | **Vitest** + **Playwright** | Unit/integration + E2E |
| Deploy | **Vercel** | Deploy Next.js một bước, preview mỗi PR |

Phương án đơn giản hơn nếu chỉ dùng một mình: bỏ auth, dùng SQLite, chạy local. Nên quyết định ở bước 0.

---

## 3. Mô hình dữ liệu

### Các bảng

**users**: `id`, `email`, `name`, `created_at`

**accounts** (ví): `id`, `user_id`, `name`, `type` (cash | bank | credit | ewallet), `initial_balance`, `archived`, `created_at`

**categories**: `id`, `user_id`, `name`, `kind` (income | expense), `parent_id` (nullable), `icon`, `color`

**transactions**: `id`, `user_id`, `type` (income | expense | transfer), `amount`, `account_id`, `to_account_id` (chỉ dùng cho transfer), `category_id` (null với transfer), `occurred_at`, `note`, `created_at`, `updated_at`

**budgets**: `id`, `user_id`, `category_id`, `month` (YYYY-MM), `amount` — unique (`user_id`, `category_id`, `month`)

### Quyết định quan trọng

- **Tiền lưu dạng số nguyên (BIGINT, đơn vị đồng)**, không bao giờ dùng float. `amount` luôn dương, chiều tiền do `type` quyết định.
- **Số dư ví được tính, không lưu**: `số dư = initial_balance + tổng thu − tổng chi + chuyển vào − chuyển ra`. Tránh lệch số khi sửa/xóa giao dịch.
- **Chuyển khoản là 1 dòng** có `account_id` (nguồn) và `to_account_id` (đích). Không tính vào thu/chi trong báo cáo.
- **Mọi truy vấn đều lọc theo `user_id`** của session — đặt trong một lớp truy cập dữ liệu chung để không quên.
- **Thời gian**: lưu `timestamptz`, hiển thị và chia tháng theo múi giờ `Asia/Ho_Chi_Minh`.
- Index: `transactions(user_id, occurred_at)`, `transactions(account_id)`, `transactions(category_id)`.

---

## 4. Cấu trúc thư mục

```
src/
  app/
    (auth)/login/
    (app)/
      dashboard/
      transactions/
      accounts/
      categories/
      budgets/
      settings/
    api/auth/[...nextauth]/
  components/        # UI dùng chung (form, bảng, biểu đồ)
  lib/
    db.ts            # Prisma client
    auth.ts          # cấu hình Auth.js
    money.ts         # định dạng & parse tiền VND
    dates.ts         # xử lý tháng/múi giờ
  server/
    queries/         # đọc dữ liệu (luôn nhận userId)
    actions/         # Server Actions ghi dữ liệu (validate bằng Zod)
  schemas/           # Zod schema dùng chung
prisma/
  schema.prisma
  seed.ts            # danh mục mặc định
tests/
  unit/  e2e/
```

---

## 5. Màn hình

1. **Đăng nhập**: nút "Đăng nhập bằng Google".
2. **Dashboard**: thẻ tổng số dư, thu/chi tháng, biểu đồ tròn chi theo danh mục, biểu đồ cột 6 tháng, 5 giao dịch gần nhất, ngân sách sắp vượt.
3. **Giao dịch**: bảng có phân trang + bộ lọc; nút "+" mở form thêm nhanh (mặc định ngày hôm nay, ví dùng gần nhất).
4. **Ví**: danh sách ví và số dư hiện tại; thêm/sửa/lưu trữ ví.
5. **Danh mục**: danh sách thu/chi, thêm/sửa/xóa (chặn xóa nếu đang có giao dịch, hoặc yêu cầu chuyển sang danh mục khác).
6. **Ngân sách**: chọn tháng, đặt hạn mức từng danh mục, thanh tiến độ; nút "copy từ tháng trước".
7. **Cài đặt**: thông tin tài khoản, xuất CSV, xóa toàn bộ dữ liệu.

---

## 6. Lộ trình theo giai đoạn

Ước lượng cho 1 người làm toàn thời gian. Làm bán thời gian thì nhân khoảng 2–3.

### Giai đoạn 0 — Khởi tạo dự án (1 ngày)

- Tạo Next.js + TypeScript, Tailwind, shadcn/ui, ESLint, Prettier.
- Kết nối Postgres, cài Prisma, migration đầu tiên.
- Thiết lập CI (GitHub Actions): lint, typecheck, test.
- Deploy bản trống lên Vercel.

**Kiểm tra:** trang chủ chạy trên URL Vercel; CI xanh.

### Giai đoạn 1 — Đăng nhập (1 ngày)

- Cấu hình Auth.js + Google OAuth, lưu user/session vào DB.
- Middleware chặn mọi route `(app)` khi chưa đăng nhập.
- Khi user mới đăng nhập lần đầu: seed danh mục mặc định.

**Kiểm tra:** chưa đăng nhập → bị chuyển về `/login`; đăng nhập xong → thấy dashboard trống và có danh mục mặc định.

### Giai đoạn 2 — Ví & Danh mục (2 ngày)

- CRUD ví, CRUD danh mục (2 cấp).
- `lib/money.ts`: format `1.250.000 ₫`, parse input người dùng gõ (`1.250.000`, `1250000`, `1,25tr` nếu muốn).

**Kiểm tra:** unit test cho format/parse tiền; tạo/sửa/xóa ví và danh mục qua UI; user A không thấy dữ liệu user B.

### Giai đoạn 3 — Giao dịch (3–4 ngày)

- Form thêm/sửa giao dịch (thu, chi, chuyển khoản), validate bằng Zod.
- Danh sách giao dịch: phân trang, lọc theo ngày/ví/danh mục/loại, tìm theo ghi chú.
- Hàm tính số dư ví theo công thức ở mục 3.

**Kiểm tra:** unit test tính số dư (gồm chuyển khoản, sửa, xóa giao dịch); E2E: thêm 1 khoản chi → số dư ví giảm đúng số tiền.

### Giai đoạn 4 — Ngân sách (2 ngày)

- Đặt ngân sách tháng theo danh mục, copy từ tháng trước.
- Tính đã chi / hạn mức, màu cảnh báo (≥80% vàng, >100% đỏ).
- Ngân sách danh mục cha bao gồm chi của danh mục con.

**Kiểm tra:** unit test tính % ngân sách, kể cả giao dịch nằm sát ranh giới tháng (23:30 ngày cuối tháng giờ Việt Nam).

### Giai đoạn 5 — Dashboard & báo cáo (2–3 ngày)

- Truy vấn tổng hợp: thu/chi theo tháng, chi theo danh mục.
- Biểu đồ tròn + cột + danh sách gần đây.
- Trạng thái rỗng (empty state) cho user mới.

**Kiểm tra:** với bộ dữ liệu seed cố định, số liệu dashboard khớp với tính tay; chuyển khoản không bị tính vào thu/chi.

### Giai đoạn 6 — Hoàn thiện & phát hành (2–3 ngày)

- Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt).
- Responsive trên màn hình 375px, loading/error state, thông báo toast.
- Rà soát bảo mật (mục 8), bật backup DB.
- Viết README: cách chạy local, biến môi trường.

**Kiểm tra:** toàn bộ E2E xanh; mở file CSV bằng Excel hiển thị đúng dấu; dùng thử trên điện thoại thật 1 tuần.

**Tổng MVP: khoảng 2,5–3 tuần toàn thời gian.**

### Giai đoạn 7 — Sau MVP (chọn theo nhu cầu thực tế)

1. Giao dịch định kỳ (tiền nhà, lương) — cron job tạo giao dịch tự động.
2. Nhập CSV/sao kê ngân hàng, có bước xem trước và chống trùng.
3. Mục tiêu tiết kiệm.
4. PWA: cài lên màn hình chính, thêm giao dịch nhanh.
5. Đa tiền tệ (lưu tiền tệ theo ví + tỷ giá theo ngày).
6. Ví chung cho gia đình (bảng thành viên + phân quyền).

---

## 7. Chiến lược kiểm thử

- **Unit (Vitest)**: tập trung vào logic tiền — parse/format, tính số dư, tính ngân sách, chia tháng theo múi giờ. Đây là chỗ dễ sai nhất.
- **Integration**: Server Actions chạy với DB test thật (Postgres trong Docker hoặc schema riêng), kiểm tra validate và lọc `user_id`.
- **E2E (Playwright)**: 3–5 luồng chính — đăng nhập (mock), thêm ví, thêm giao dịch, đặt ngân sách, xem dashboard.
- CI chạy toàn bộ trên mỗi PR.

---

## 8. Bảo mật & dữ liệu

- Mọi Server Action: kiểm tra session → validate Zod → truy vấn kèm `user_id`. Không tin `user_id` gửi từ client.
- Khi sửa/xóa theo `id`, luôn kiểm tra bản ghi thuộc user hiện tại.
- Không log số tiền hay ghi chú vào log hệ thống.
- Bí mật (OAuth secret, DATABASE_URL) chỉ nằm trong biến môi trường, không commit.
- Bật backup tự động của nhà cung cấp DB; có chức năng xuất CSV để người dùng tự giữ dữ liệu.

---

## 9. Triển khai

- **Môi trường**: `local` (Docker Postgres) → `preview` (Vercel mỗi PR, DB branch của Neon) → `production`.
- Migration chạy bằng `prisma migrate deploy` trong bước build production.
- Biến môi trường: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

---

## 10. Rủi ro chính

| Rủi ro | Cách phòng |
|---|---|
| Sai số tiền do float | Lưu BIGINT, test parse/format |
| Số dư lệch sau khi sửa/xóa | Tính số dư từ giao dịch, không lưu riêng |
| Giao dịch bị tính sai tháng | Chia tháng theo `Asia/Ho_Chi_Minh`, test ranh giới |
| Lộ dữ liệu giữa các user | Lớp truy vấn bắt buộc `userId` + integration test |
| Phình phạm vi | Chốt danh sách MVP ở mục 1, mọi thứ khác vào giai đoạn 7 |

---

## 11. Câu hỏi cần trả lời trước khi bắt đầu

1. App chỉ cho riêng bạn dùng, hay cho nhiều người đăng ký?
2. Có cần dùng chung với vợ/chồng/gia đình ngay từ đầu không?
3. Có giao dịch ngoại tệ (USD…) thường xuyên không?
4. Bạn đã quen stack nào (React/Next.js, Vue, Python/Django…)? Nếu khác, nên đổi stack cho phù hợp.
5. Có muốn nhập sao kê ngân hàng sớm không? Nếu có, ngân hàng nào?
