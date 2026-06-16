"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

type MoneyProps = {
  value: number;
  className?: string;
  compact?: boolean;
  title?: string;
};

export function MoneyValue({ value, className, compact, title }: MoneyProps) {
  return (
    <span
      className={cn(
        "tabular-nums",
        compact ? "text-xs font-medium" : "text-sm font-semibold",
        className,
      )}
      title={title}
    >
      {formatCurrency(value)}
    </span>
  );
}

export function MoneyPair({
  pct,
  value,
  pctClassName,
  valueClassName,
}: {
  pct?: number | null;
  value: number;
  pctClassName?: string;
  valueClassName?: string;
}) {
  if (value <= 0 && (pct == null || pct <= 0)) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  return (
    <div className="leading-tight">
      {pct != null && pct > 0 ? (
        <p className={cn("text-[10px] text-zinc-500", pctClassName)}>{pct}%</p>
      ) : null}
      <MoneyValue value={value} compact className={valueClassName} />
    </div>
  );
}

export function CellDash() {
  return <span className="text-xs text-zinc-600">—</span>;
}

const compactField =
  "h-8 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-amber-500/60";

export function CompactSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(compactField, className)} {...props}>
      {children}
    </select>
  );
}

export function CompactNumberInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(compactField, "w-14", className)} {...props} />;
}

export function Th({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500",
        className,
      )}
      title={title}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("whitespace-nowrap px-2 py-2 align-middle text-xs", className)}>{children}</td>
  );
}
