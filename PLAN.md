# Kế hoạch xây dựng Web App Quản lý Tài chính Cá nhân

## 0. Bối cảnh & giả định

### Đã chốt

- **Chỉ một người dùng** (chủ app). Không có đăng ký, không ví chung.
- **Chỉ dùng VND**. Không có ngoại tệ.
- **Nhập sao kê ngân hàng nằm trong MVP**.
- **Giao diện theo phong cách glassmorphism**.
- **Ngân hàng: Techcombank**.
- **Web app dùng tốt cả trên điện thoại và máy tính**, deploy lên cloud nên cần màn hình đăng nhập để bảo vệ dữ liệu.
- **Giữ stack đề xuất ở mục 2**. Claude viết code; chủ app tạo các tài khoản dịch vụ (Vercel, Neon, Google OAuth).

- **Sao kê Techcombank tải được dạng PDF và XLS**. MVP chỉ đọc **XLS** (dễ và chính xác hơn); đọc PDF để sau MVP.

### Giả định (cần xác nhận)

- File XLS có cùng các cột như bản PDF (xem mục 4). Cần một file XLS mẫu để kiểm tra.
- Chi phí hosting càng thấp càng tốt (gói miễn phí).

---

## 1. Phạm vi MVP

### Có trong MVP

1. **Đăng nhập** chỉ cho một email (Google OAuth + danh sách cho phép đúng 1 email).
2. **Ví / tài khoản**: tiền mặt, ngân hàng, thẻ tín dụng, ví điện tử. Mỗi ví có số dư ban đầu.
3. **Giao dịch**: thu, chi, chuyển khoản giữa các ví. Gồm số tiền, ngày, danh mục, ghi chú.
4. **Danh mục**: bộ mặc định (Ăn uống, Đi lại, Nhà ở, Lương…) + tự thêm/sửa. Tối đa 2 cấp.
5. **Nhập sao kê ngân hàng** (chi tiết ở mục 4):
   - Tải lên file XLS sao kê Techcombank, xem trước rồi mới lưu.
   - Chống nhập trùng.
   - Tự gợi ý danh mục theo quy tắc từ khóa.
6. **Ngân sách tháng** theo danh mục, có cảnh báo khi vượt.
7. **Dashboard**: tổng số dư, thu/chi tháng, chi theo danh mục, xu hướng 6 tháng.
8. **Lọc & tìm kiếm** giao dịch, **xuất CSV**.

### Không có trong MVP

- Giao dịch định kỳ, mục tiêu tiết kiệm, đọc sao kê PDF, PWA, thông báo.
- Đã loại hẳn (không cần theo yêu cầu): đa tiền tệ, nhiều người dùng, ví chung.

---

## 2. Công nghệ đề xuất

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Frontend + backend chung một repo, Server Actions |
| UI | **Tailwind CSS + shadcn/ui** | Dễ tùy biến thành phong cách glass, có sẵn form/table/dialog |
| Biểu đồ | **Recharts** | Tùy chỉnh màu/nền trong suốt dễ dàng |
| Database | **PostgreSQL** (Neon) | Gói miễn phí, có backup |
| ORM | **Prisma** | Schema + migration dễ đọc |
| Auth | **Auth.js** – Google, session JWT, chỉ cho phép `OWNER_EMAIL` | Không cần bảng user/session trong DB |
| Đọc file sao kê | **SheetJS (xlsx)** | Đọc được file .xls/.xlsx |
| Validation | **Zod** | Dùng chung cho form và dữ liệu import |
| Test | **Vitest** + **Playwright** | Unit + E2E |
| Deploy | **Vercel** | Deploy một bước |

---

## 3. Mô hình dữ liệu

Vì chỉ có một người dùng, **bỏ bảng `users` và cột `user_id`**. Mọi bảo vệ dữ liệu nằm ở lớp đăng nhập.

### Các bảng

**accounts** (ví): `id`, `name`, `type` (cash | bank | credit | ewallet), `bank_code` (nullable, ví dụ VCB, TCB), `initial_balance`, `archived`, `created_at`

**categories**: `id`, `name`, `kind` (income | expense), `parent_id`, `icon`, `color`

**transactions**: `id`, `type` (income | expense | transfer), `amount`, `account_id`, `to_account_id`, `category_id`, `occurred_at`, `note`, `raw_description` (cột Diễn giải), `counterparty` (cột Đối tác), `counterparty_bank` (cột NH Đối tác), `import_batch_id` (nullable), `import_key` (nullable, unique theo ví — xem mục 4), `created_at`, `updated_at`

**budgets**: `id`, `category_id`, `month` (YYYY-MM), `amount` — unique (`category_id`, `month`)

**import_batches**: `id`, `account_id`, `file_name`, `period_from`, `period_to`, `opening_balance`, `closing_balance`, `row_count`, `imported_count`, `skipped_count`, `created_at`

**category_rules** (tự phân loại): `id`, `field` (counterparty | description), `pattern` (từ khóa, không phân biệt hoa thường/dấu), `category_id`, `priority`

**settings**: `owner_name` (tên chủ tài khoản, viết không dấu như trên sao kê — dùng để nhận ra chuyển tiền cho chính mình)

### Quyết định quan trọng

- **Tiền lưu BIGINT (đơn vị đồng)**, không dùng float. `amount` luôn dương, chiều tiền do `type` quyết định.
- **Số dư ví được tính từ giao dịch**, không lưu riêng: `initial_balance + thu − chi + chuyển vào − chuyển ra`.
- **Chuyển khoản là 1 dòng** (`account_id` → `to_account_id`), không tính vào thu/chi.
- **Thời gian** lưu `timestamptz`, chia tháng theo `Asia/Ho_Chi_Minh`.
- Index: `transactions(occurred_at)`, `transactions(account_id, import_key)`, `transactions(category_id)`.

---

## 4. Thiết kế tính năng nhập sao kê (Techcombank)

### Cấu trúc file sao kê Techcombank (đã xem từ bản PDF)

- **Phần đầu**: tên ngân hàng, tiêu đề "Sổ phụ kiêm phiếu báo nợ/có", khoảng ngày (Từ ngày / Đến ngày), thông tin khách hàng.
- **Bảng giao dịch chính**, 8 cột:

| Cột | Ý nghĩa | Cách dùng |
|---|---|---|
| Ngày giao dịch | `dd/mm/yyyy` | Ngày giao dịch |
| Đối tác | Tên người/đơn vị nhận hoặc gửi | Tự phân loại, nhận ra chuyển cho chính mình |
| NH Đối tác | Ngân hàng của đối tác | Lưu để tham khảo |
| Diễn giải | Nội dung chuyển khoản | `raw_description`, tự phân loại |
| Số bút toán | Mã giao dịch, dạng `FT…` | Khóa chống trùng |
| Nợ TKTT | Tiền ra | Khoản chi |
| Có TKTT | Tiền vào | Khoản thu |
| Số dư | Số dư sau giao dịch | Đối chiếu |

- **Dòng đặc biệt trong bảng**: "Số dư đầu kỳ" (đầu bảng), "Cộng doanh số" và "Số dư cuối kỳ" (cuối bảng). Không phải giao dịch, nhưng dùng để đối chiếu.
- **Phụ lục "Sinh lời tự động"** (nếu tài khoản bật tính năng này): một bảng riêng với cột khác, số âm ghi trong ngoặc `(3,215,328)`. Đây là tiền tự động chuyển qua lại với chứng chỉ tiền gửi, **không phải thu/chi**. Bảng chính đã tự cân đối mà không cần phụ lục, nên **bỏ qua toàn bộ phụ lục**.
- **Lưu ý của ngân hàng**: "Ngày giao dịch" là ngày làm việc tiếp theo sau ngày phát sinh thực tế. Giao dịch cuối tuần sẽ mang ngày thứ Hai.

### Luồng người dùng

1. Chọn ví Techcombank → tải file XLS lên.
2. **Màn hình xem trước**: bảng các dòng sẽ nhập, mỗi dòng có:
   - danh mục được gợi ý (sửa được),
   - đánh dấu "trùng — bỏ qua",
   - gợi ý "chuyển khoản sang ví khác" nếu đối tác là chính mình (sửa được).
   - Phía trên bảng: số dư đầu kỳ, số dư cuối kỳ, kết quả đối chiếu.
3. Bấm "Nhập" → lưu trong **một transaction DB** (lỗi thì không lưu dòng nào).
4. Hiện tổng kết: đã nhập X, bỏ qua Y trùng.

Chỉ có một ngân hàng nên **không làm màn hình ghép cột** ở MVP; bộ đọc được viết riêng cho định dạng Techcombank. Nếu sau này thêm ngân hàng khác thì mới làm.

### Xử lý kỹ thuật

- **Tìm bảng**: dò dòng tiêu đề có "Ngày giao dịch" và "Số bút toán"; dừng khi gặp "Cộng doanh số". Bỏ mọi thứ phía sau (kể cả phụ lục).
- **Parse ngày** `dd/mm/yyyy`; nếu ô là kiểu ngày số của Excel thì chuyển đổi riêng.
- **Ngày thực tế**: nếu Diễn giải có cụm `NGAY dd/mm/yyyy` (thanh toán thẻ/ví), lấy ngày đó làm `occurred_at`; không có thì dùng Ngày giao dịch. Giúp giao dịch cuối tháng không bị đẩy sang tháng sau.
- **Parse số tiền**: Techcombank dùng **dấu phẩy** phân cách nghìn (`2,000,000`); số âm dạng `(...)`. Ô trống = 0.
- **Chống trùng**: `import_key` = Số bút toán. Một số dòng không có Số bút toán (ví dụ trả lãi) → dùng `hash(ngày, số tiền, chiều tiền, diễn giải đã chuẩn hóa, số thứ tự trong ngày)`. Nhập lại cùng file → 0 dòng mới. Hai file có khoảng ngày chồng nhau cũng không bị trùng.
- **Tự phân loại**: so khớp quy tắc với `counterparty` và `raw_description` (đã bỏ dấu, viết thường) theo `priority`.
  - Khi sửa danh mục ở màn xem trước, gợi ý tạo quy tắc mới (ví dụ Đối tác "HIGHLANDS COFFEE" → Ăn uống).
  - Lưu ý: tên chủ tài khoản thường tự xuất hiện trong Diễn giải của mọi lần chuyển tiền đi ("… chuyen tien"), nên **chỉ dùng cột Đối tác** để nhận ra chuyển cho chính mình.
- **Lãi tiền gửi / Sinh lời**: các dòng như "Tra lai so du", "Thanh toan loi nhuan Sinh loi" → danh mục thu "Tiền lãi". Dòng "Chuyen tien loi … sang diem Upoint" là tiền ra tương ứng → danh mục chi riêng, để thu/chi tháng không bị phóng đại.
- **Đối chiếu số dư** (bắt buộc ở bảng chính):
  - `đầu kỳ + tổng Có − tổng Nợ = cuối kỳ`, và tổng Nợ/Có khớp dòng "Cộng doanh số". Sai → báo lỗi đọc file, không cho nhập.
  - Sau khi nhập: số dư ví trong app = số dư cuối kỳ. Lệch → cảnh báo (thường do thiếu một kỳ sao kê).
- **Lần nhập đầu tiên**: lấy "Số dư đầu kỳ" làm số dư ban đầu của ví nếu ví chưa có giao dịch.
- **Không lưu file gốc**: file chỉ được đọc trong bộ nhớ rồi bỏ, vì sao kê chứa thông tin nhạy cảm.

---

## 5. Thiết kế giao diện Glassmorphism

### Nguyên tắc

- **Nền**: gradient nhiều màu hoặc mesh gradient (tím – xanh dương – hồng), có vài "đốm màu" mờ (blob) phía sau để hiệu ứng kính nổi bật.
- **Thẻ kính** (card, sidebar, dialog):
  - `backdrop-filter: blur(16–24px)`,
  - nền trắng độ trong 10–15% (chế độ tối: đen 20–30%),
  - viền 1px trắng 20–30%, bo góc 16–24px, bóng đổ mềm.
- **Chữ & số tiền**: phải đạt độ tương phản WCAG AA (≥ 4.5:1) trên nền kính. Số tiền dùng font số đều (`tabular-nums`), cỡ lớn, đậm. Thu màu xanh lá, chi màu đỏ/hồng, đủ sáng để đọc trên nền mờ.
- **Biểu đồ**: nền trong suốt, đường lưới mờ, màu đồng bộ với gradient nền.
- Có cả **chế độ sáng và tối**. Chế độ tối thường hợp glassmorphism hơn, nên đặt làm mặc định.

### Thành phần dùng chung (bọc lại shadcn/ui)

- `GlassCard`, `GlassPanel` (sidebar/thanh điều hướng dưới trên mobile), `GlassDialog`, `GlassInput`, `GlassButton`, `StatTile` (thẻ con số trên dashboard).
- Khai báo token trong Tailwind config: độ mờ, độ trong, màu viền, bóng. Không viết số cứng rải rác trong code.

### Rủi ro riêng của phong cách này

- **Hiệu năng trên điện thoại**: `backdrop-filter` tốn GPU. Không lồng kính trong kính, chỉ làm mờ các lớp lớn, tắt blur cho từng dòng trong bảng dài.
- **Khó đọc**: bảng giao dịch và màn xem trước sao kê có nhiều chữ → dùng nền kính đục hơn (độ trong 25–40%) ở các vùng này.
- **Trình duyệt không hỗ trợ**: dùng `@supports (backdrop-filter: blur())` để chuyển về nền đặc bán trong suốt.
- Tôn trọng `prefers-reduced-transparency` / `prefers-reduced-motion` nếu trình duyệt có hỗ trợ.

---

## 6. Cấu trúc thư mục

```
src/
  app/
    login/
    (app)/
      dashboard/  transactions/  accounts/  categories/
      budgets/  import/  settings/
    api/auth/[...nextauth]/
    dev/ui/            # trang xem thử toàn bộ component glass (chỉ bật ở local)
  components/
    glass/             # GlassCard, GlassPanel, GlassDialog...
    charts/  forms/
  lib/
    db.ts  auth.ts
    money.ts           # format/parse VND
    dates.ts           # tháng & múi giờ
    vn-text.ts         # bỏ dấu tiếng Việt, chuẩn hóa chuỗi
  server/
    queries/  actions/
    import/
      parse.ts         # đọc XLS Techcombank thành dòng thô
      normalize.ts     # dòng thô → giao dịch chuẩn
      dedupe.ts        # tính import_key
      categorize.ts    # áp quy tắc danh mục
  schemas/
prisma/
  schema.prisma
  seed.ts              # danh mục + quy tắc mặc định
tests/
  unit/  e2e/
  fixtures/statements/ # file sao kê GIẢ theo cấu trúc Techcombank
```

---

## 7. Màn hình

1. **Đăng nhập**: một thẻ kính giữa màn hình, nút Google.
2. **Dashboard**: các `StatTile` (tổng số dư, thu, chi tháng này), biểu đồ tròn theo danh mục, biểu đồ cột 6 tháng, giao dịch gần đây, ngân sách sắp vượt.
3. **Giao dịch**: bảng + bộ lọc, nút "+" thêm nhanh. Lọc được theo "nhập từ sao kê" / "nhập tay".
4. **Nhập sao kê**: tải file → xem trước → kết quả. Kèm lịch sử các lần nhập (có nút hoàn tác cả một lần nhập).
5. **Ví**: danh sách ví và số dư.
6. **Danh mục & quy tắc**: quản lý danh mục và quy tắc tự phân loại.
7. **Ngân sách**: chọn tháng, đặt hạn mức, thanh tiến độ, copy từ tháng trước.
8. **Cài đặt**: chế độ sáng/tối, xuất CSV, xóa dữ liệu.

---

## 8. Lộ trình theo giai đoạn

Ước lượng cho 1 người làm toàn thời gian. Làm bán thời gian thì nhân khoảng 2–3.

### Giai đoạn 0 — Khởi tạo dự án (1 ngày)

- Next.js + TypeScript, Tailwind, shadcn/ui, ESLint, Prettier.
- Neon Postgres + Prisma, migration đầu tiên.
- GitHub Actions: lint, typecheck, test. Deploy bản trống lên Vercel.

**Kiểm tra:** URL Vercel chạy được; CI xanh.

### Giai đoạn 1 — Hệ thống giao diện glass (2 ngày)

- Nền gradient, token trong Tailwind, các component `glass/*`, chế độ sáng/tối.
- Trang `/dev/ui` hiển thị mọi component.
- Layout chính: sidebar (desktop), thanh điều hướng dưới (mobile).

**Kiểm tra:**
- Đo tương phản chữ/số tiền trên nền kính đạt ≥ 4.5:1 ở cả 2 chế độ.
- Cuộn mượt trên điện thoại tầm trung (không giật khi cuộn trang `/dev/ui`).
- Tắt `backdrop-filter` bằng DevTools → giao diện vẫn đọc được.

### Giai đoạn 2 — Đăng nhập (0,5 ngày)

- Auth.js + Google, chỉ chấp nhận `OWNER_EMAIL`. Middleware chặn mọi route `(app)`.

**Kiểm tra:** email khác đăng nhập → bị từ chối; chưa đăng nhập → về `/login`.

### Giai đoạn 3 — Ví & Danh mục (1,5 ngày)

- CRUD ví và danh mục. Seed danh mục mặc định.
- `lib/money.ts`: format `1.250.000 ₫`, parse input.

**Kiểm tra:** unit test format/parse tiền; thao tác CRUD qua UI.

### Giai đoạn 4 — Giao dịch (3 ngày)

- Form thu/chi/chuyển khoản, danh sách + lọc + tìm kiếm, hàm tính số dư.

**Kiểm tra:** unit test số dư (có chuyển khoản, sửa, xóa); E2E: thêm khoản chi → số dư giảm đúng.

### Giai đoạn 5 — Nhập sao kê Techcombank (3–4 ngày)

- Bộ đọc XLS Techcombank: `parse` → `normalize` → `dedupe` → `categorize` như mục 4.
- Màn xem trước; lưu trong một transaction DB.
- Đối chiếu số dư, lịch sử nhập, hoàn tác cả lần nhập.
- Quản lý `category_rules`, cài đặt `owner_name`; seed vài quy tắc phổ biến (MOCA/Grab, Highlands, Shopee, điện, nước, lãi tiền gửi…).

**Kiểm tra:**
- Unit test với file XLS giả có đúng cấu trúc Techcombank (gồm dòng đầu kỳ, cuối kỳ, dòng không có Số bút toán, phụ lục Sinh lời): số dòng, tổng Nợ/Có và số dư cuối khớp.
- Chạy thử trên file XLS thật của bạn **ngay trong máy/phiên làm việc**, không đưa lên repo: tổng Nợ/Có khớp dòng "Cộng doanh số".
- Nhập cùng một file 2 lần → lần 2 nhập 0 dòng.
- Số dư app sau khi nhập = số dư cuối trên sao kê.
- Hoàn tác một lần nhập → số dư quay về như trước.

### Giai đoạn 6 — Ngân sách (1,5 ngày)

- Đặt ngân sách tháng, copy từ tháng trước, cảnh báo ≥80% / >100%. Ngân sách danh mục cha tính cả danh mục con.

**Kiểm tra:** unit test %, gồm giao dịch 23:30 ngày cuối tháng (giờ VN).

### Giai đoạn 7 — Dashboard (2 ngày)

- Truy vấn tổng hợp, biểu đồ, empty state.

**Kiểm tra:** với dữ liệu seed cố định, số liệu khớp với tính tay; chuyển khoản không bị tính vào thu/chi.

### Giai đoạn 8 — Hoàn thiện & phát hành (2 ngày)

- Xuất CSV (UTF-8 có BOM cho Excel), loading/error state, toast.
- Rà soát bảo mật (mục 10), bật backup DB, viết README.

**Kiểm tra:** E2E xanh; dùng thật trên điện thoại 1 tuần với sao kê tháng gần nhất.

**Tổng MVP: khoảng 3–3,5 tuần toàn thời gian.** Bỏ được màn ghép cột nhờ chỉ dùng một ngân hàng.

### Giai đoạn 9 — Sau MVP

1. Giao dịch định kỳ (tiền nhà, lương).
2. Tự ghép cặp chuyển khoản giữa 2 ví của mình (cùng số tiền, lệch ≤ 1 ngày).
3. Đọc sao kê PDF Techcombank (file PDF là bản điện tử, không phải ảnh quét, nên đọc được chữ trực tiếp).
4. Mục tiêu tiết kiệm.
5. PWA: cài lên màn hình chính.

---

## 9. Chiến lược kiểm thử

- **Unit (Vitest)**, ưu tiên các chỗ dễ sai nhất:
  - parse/format tiền, bỏ dấu tiếng Việt,
  - parse ngày sao kê, chống trùng, tự phân loại,
  - tính số dư, tính ngân sách, chia tháng.
- **Fixture sao kê**: mỗi ngân hàng một file mẫu trong `tests/fixtures/statements/`, kèm kết quả mong đợi (số dòng, tổng nợ, tổng có, số dư cuối).
- **Integration**: Server Actions với DB test thật.
- **E2E (Playwright)**: thêm giao dịch, nhập sao kê từ đầu đến cuối, đặt ngân sách, xem dashboard.
- CI chạy toàn bộ mỗi lần push.

---

## 10. Bảo mật & dữ liệu

- Chỉ `OWNER_EMAIL` được đăng nhập; mọi Server Action kiểm tra session trước khi làm gì.
- Không lưu file sao kê gốc; không ghi số tiền, mô tả giao dịch vào log.
- **Repo đang ở chế độ công khai (public)**: tuyệt đối không đưa sao kê thật lên repo. Fixture sao kê chỉ dùng dữ liệu giả, dựng theo đúng cấu trúc cột của file Techcombank.
- Bí mật chỉ nằm trong biến môi trường.
- Bật backup tự động của Neon; có xuất CSV để tự lưu dữ liệu.

---

## 11. Triển khai

- Môi trường: `local` (Docker Postgres) → `preview` (Vercel + Neon branch) → `production`.
- `prisma migrate deploy` khi build production.
- Biến môi trường: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`.

---

## 12. Rủi ro chính

| Rủi ro | Cách phòng |
|---|---|
| Techcombank đổi định dạng file sao kê | Đối chiếu số dư bắt buộc → phát hiện ngay và từ chối nhập; sửa bộ đọc + fixture |
| File XLS khác cấu trúc bản PDF | Kiểm tra bằng file XLS thật trước khi bắt đầu giai đoạn 5 |
| Nhập trùng hoặc thiếu giao dịch | `import_key` (Số bút toán) + đối chiếu số dư bắt buộc |
| Chuyển tiền giữa 2 ví của mình bị tính 2 lần (chi ở ví A, thu ở ví B) | Cho đổi dòng thành chuyển khoản ở màn xem trước; tự ghép cặp ở giai đoạn 9 |
| Glassmorphism khó đọc hoặc giật trên mobile | Kiểm tra tương phản và hiệu năng ngay ở giai đoạn 1 |
| Sai số tiền / sai tháng | BIGINT + múi giờ VN + unit test |
| Phình phạm vi | Chốt mục 1, mọi thứ khác vào giai đoạn 9 |

---

## 13. Câu hỏi còn mở

1. **File XLS mẫu**: gửi lên phiên chat giống cách đã gửi file PDF (không đưa lên GitHub), để xác nhận cấu trúc giống bản PDF.
2. **Ngoài Techcombank, bạn có tài khoản/ví khác hay chuyển tiền qua lại không** (ví dụ tài khoản ngân hàng khác, ví MoMo, tiền mặt)? Để tạo sẵn các ví đó.
