"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { GlassButton } from "./glass/glass-button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <GlassButton
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
    >
      {/* Hiện cả hai biểu tượng, CSS chọn cái đúng → không lệch khi hydrate. */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
      <span className="hidden dark:inline">Giao diện sáng</span>
      <span className="dark:hidden">Giao diện tối</span>
    </GlassButton>
  );
}
