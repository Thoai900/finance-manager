import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { sessionCookie } from "./session";

export const OWNER_STATE = "test-results/.auth/owner.json";

/** Mọi test E2E mặc định đăng nhập bằng email chủ app (OWNER_EMAIL). */
export default async function globalSetup() {
  if (!process.env.AUTH_SECRET || !process.env.OWNER_EMAIL) {
    throw new Error("E2E cần AUTH_SECRET và OWNER_EMAIL (xem .env.example)");
  }
  mkdirSync(dirname(OWNER_STATE), { recursive: true });
  const state = {
    cookies: [await sessionCookie(process.env.OWNER_EMAIL)],
    origins: [],
  };
  writeFileSync(OWNER_STATE, JSON.stringify(state));
}
