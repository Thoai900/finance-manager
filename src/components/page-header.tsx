import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {action}
      </div>
    </div>
  );
}
