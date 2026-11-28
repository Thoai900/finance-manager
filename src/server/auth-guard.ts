import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

/**
 * Lớp kiểm tra quyền (Data Access Layer): gọi ở đầu MỌI hàm đọc dữ liệu và MỌI Server Action.
 * Không phải chủ app → chuyển về trang đăng nhập. Kiểm tra lại email mỗi lần,
 * nên đổi OWNER_EMAIL là phiên cũ hết hiệu lực ngay.
 */
export const requireOwner = cache(async () => {
  await connection(); // chỉ chạy khi có request (Auth.js dùng crypto ngẫu nhiên, không được prerender)
  const session = await auth();
  const email = session?.user?.email;
  if (!isOwnerEmail(email)) redirect("/login");
  return { email: email! };
});
