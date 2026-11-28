import "dotenv/config";
import { encode } from "next-auth/jwt";

const COOKIE = "authjs.session-token"; // http://localhost dùng tên không có tiền tố __Secure-

/** Cookie phiên Auth.js hợp lệ cho một email, ký bằng AUTH_SECRET của môi trường test. */
export async function sessionCookie(email: string) {
  const value = await encode({
    token: { email, name: "E2E", sub: `e2e-${email}` },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE,
  });
  return {
    name: COOKIE,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  };
}
