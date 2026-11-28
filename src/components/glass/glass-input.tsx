import { cn } from "@/lib/cn";

export function GlassInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "glass-strong h-10 w-full rounded-xl px-3 text-sm text-fg placeholder:text-fg-muted",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
