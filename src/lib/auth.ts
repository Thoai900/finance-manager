import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isOwnerEmail } from "./owner";

// Đăng nhập Google; phiên lưu trong cookie JWT mã hoá (không cần bảng user/session).
// Biến môi trường: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, OWNER_EMAIL.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    // Chỉ email chủ app, đã được Google xác minh, mới đăng nhập được.
    signIn({ profile }) {
      return profile?.email_verified === true && isOwnerEmail(profile.email);
    },
  },
});
