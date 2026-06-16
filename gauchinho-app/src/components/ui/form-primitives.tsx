import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

/** Campos em modais/páginas com fundo escuro (sobrescreve text-zinc-900 do input padrão). */
export const surfaceInputDark =
  "border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 caret-zinc-100";

export const surfaceInputDarkSlate =
  "border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 caret-slate-100";

export const surfaceSelectDark = "border-zinc-700 bg-zinc-950 text-zinc-100";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "gold" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        variant === "default" && "bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-800 disabled:text-zinc-400",
        variant === "outline" &&
          "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500",
        variant === "ghost" &&
          "text-zinc-800 hover:bg-zinc-100 disabled:text-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:disabled:text-zinc-500",
        variant === "gold" &&
          "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
