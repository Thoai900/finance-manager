import { cn } from "@/lib/cn";

type GlassButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "glass";
};

export function GlassButton({
  variant = "glass",
  className,
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary"
          ? "bg-accent text-accent-fg shadow-lg shadow-accent/30 hover:brightness-110"
          : "glass hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}
