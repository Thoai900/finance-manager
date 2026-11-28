import { cn } from "@/lib/cn";

type GlassCardProps = React.ComponentProps<"div"> & {
  /** Kính đục hơn, dùng cho vùng nhiều chữ (bảng, form). */
  strong?: boolean;
};

export function GlassCard({ strong, className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-2xl p-5",
        className,
      )}
      {...props}
    />
  );
}
