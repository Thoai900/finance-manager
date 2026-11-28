# Quản lý tài chính

Web app quản lý thu chi cá nhân. Kế hoạch chi tiết: [PLAN.md](PLAN.md).

## Chạy trên máy

Cần Node.js 22 và PostgreSQL 16.

```bash
cp .env.example .env        # điền DATABASE_URL, AUTH_SECRET, OWNER_EMAIL...
npm install                 # tự chạy prisma generate
npx prisma migrate dev      # tạo bảng trong database
npm run dev                 # mở http://localhost:3000
```

## Lệnh kiểm tra

```bash
npm run format:check   # định dạng code (Prettier)
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm test               # Vitest (cần database đang chạy)
npm run build          # build production
```

CI trên GitHub Actions chạy đủ các lệnh trên mỗi lần push.

## Biến môi trường

| Biến                                   | Ý nghĩa                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                         | Chuỗi kết nối PostgreSQL (Neon khi chạy thật)                      |
| `AUTH_SECRET`                          | Khoá mã hoá cookie đăng nhập (`openssl rand -base64 32`)           |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Mã OAuth của Google Cloud Console                                  |
| `OWNER_EMAIL`                          | Email Google duy nhất được vào app; để trống thì không ai vào được |

Địa chỉ chuyển hướng cần khai báo trong Google Cloud Console: `https://<tên-miền>/api/auth/callback/google`.
