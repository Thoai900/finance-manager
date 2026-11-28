import { type NextRequest, NextResponse } from "next/server";

/** Tên cookie phiên của Auth.js (http và https; cookie lớn có thể bị chia thành ".0", ".1"). */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/**
 * Chặn sớm: chưa có cookie phiên → về trang đăng nhập.
 * Đây chỉ là kiểm tra lạc quan; kiểm tra thật nằm ở requireOwner() (src/server/auth-guard.ts).
 */
export function proxy(request: NextRequest) {
  const names = request.cookies.getAll().map((c) => c.name);
  const hasSession = names.some((n) =>
    SESSION_COOKIES.some((s) => n === s || n.startsWith(`${s}.`)),
  );
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
