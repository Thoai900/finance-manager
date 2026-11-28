"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/result";

/**
 * Gửi form tới Server Action mà không tự xoá dữ liệu đã nhập khi có lỗi
 * (React tự reset form nếu dùng `<form action>`).
 */
export function useActionForm(
  action: (formData: FormData) => Promise<ActionResult>,
  onSuccess: () => void,
) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setError(null);
        onSuccess();
      } else {
        setError(result.error);
      }
    });
  }

  return { onSubmit, error, pending };
}
