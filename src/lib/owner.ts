/**
 * App chỉ có một người dùng: email trong biến môi trường OWNER_EMAIL.
 * Chưa đặt OWNER_EMAIL → không ai vào được (an toàn khi quên cấu hình).
 */
export function isOwnerEmail(
  email: string | null | undefined,
  ownerEmail: string | undefined = process.env.OWNER_EMAIL,
): boolean {
  const owner = ownerEmail?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
