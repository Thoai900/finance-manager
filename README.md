# Quản lý tài chính

Web app quản lý thu chi cá nhân. Kế hoạch chi tiết: [PLAN.md](PLAN.md).

## Chạy trên máy

Cần Node.js 22 và PostgreSQL 16.

```bash
cp .env.example .env        # sửa DATABASE_URL nếu cần
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
