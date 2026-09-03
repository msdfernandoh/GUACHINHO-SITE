"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";

export const GRUPO_TABLE_COLSPAN = 15;

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

type CompactMoneyInputProps = {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
};

/** Campo compacto da tabela de grupos — mesma máscara BRL do MoneyInput. */
export function CompactMoneyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
}: CompactMoneyInputProps) {
  const [display, setDisplay] = useState(() => (value > 0 ? formatBRL(value) : ""));

  useEffect(() => {
    const formatted = value > 0 ? formatBRL(value) : "";
    setDisplay((prev) => {
      const parsedPrev = parseBRLMoney(prev);
      if (parsedPrev === value && prev === formatted) return prev;
      if (value <= 0 && prev === "") return prev;
      return formatted;
    });
  }, [value]);

  return (
    <input
      inputMode="numeric"
      className={cn(compactField, className)}
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const masked = maskBRLMoneyInput(e.target.value);
        setDisplay(masked);
        onValueChange(parseBRLMoney(masked) ?? 0);
      }}
      onBlur={() => {
        if (value > 0) setDisplay(formatBRL(value));
        else setDisplay("");
      }}
    />
  );
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
        "grupo-table-heading whitespace-nowrap px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white",
        className,
      )}
      title={title}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={cn("whitespace-nowrap px-2 py-2 align-middle text-xs", className)}
      title={title}
    >
      {children}
    </td>
  );
}
