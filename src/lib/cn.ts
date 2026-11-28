import { twMerge } from "tailwind-merge";

/** Ghép class Tailwind; class truyền sau ghi đè class trùng loại (ví dụ `p-0` thắng `p-5`). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}
