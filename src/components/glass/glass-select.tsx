import { cn } from "@/lib/cn";

export function GlassSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "glass-strong h-10 w-full rounded-xl px-3 text-sm text-fg",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        "[&>option]:bg-bg [&>option]:text-fg",
        className,
      )}
      {...props}
    />
  );
}
