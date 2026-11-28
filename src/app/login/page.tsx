import { Suspense } from "react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { loginWithGoogle } from "@/server/actions/auth";

const ERRORS: Record<string, string> = {
  AccessDenied: "Tài khoản Google này không có quyền truy cập ứng dụng.",
};

async function LoginError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const error = (await searchParams).error;
  if (!error) return null;
  const code = Array.isArray(error) ? error[0] : error;
  return (
    <p role="alert" className="text-sm text-expense">
      {ERRORS[code] ?? "Đăng nhập không thành công. Hãy thử lại."}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <GlassCard className="flex w-full max-w-sm flex-col gap-5 p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý tài chính</h1>
          <p className="mt-1 text-sm text-fg-muted">Đăng nhập để tiếp tục</p>
        </div>
        <form action={loginWithGoogle}>
          <GlassButton type="submit" variant="primary" className="w-full">
            Đăng nhập bằng Google
          </GlassButton>
        </form>
        <Suspense fallback={null}>
          <LoginError searchParams={searchParams} />
        </Suspense>
      </GlassCard>
    </main>
  );
}
