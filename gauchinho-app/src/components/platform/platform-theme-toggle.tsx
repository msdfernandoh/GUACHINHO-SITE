"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function PlatformThemeToggle() {
  useEffect(() => {
    const saved = localStorage.getItem("platform-theme");
    const next = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", next);
  }, []);
  return <button type="button" aria-label="Alternar tema" onClick={() => {
    const next = !document.documentElement.classList.contains("dark");
    localStorage.setItem("platform-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Moon className="h-4 w-4 dark:hidden"/><Sun className="hidden h-4 w-4 dark:block"/></button>;
}
