"use client";

import { useEffect, useState } from "react";
import { parseBrazilianNumber } from "@/lib/utils/format";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Input, Label } from "@/components/ui/form-primitives";

type Props = {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  help?: string;
  className?: string;
  highlight?: boolean;
};

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  help,
  className,
  highlight,
}: Props) {
  const [draft, setDraft] = useState(formatCurrency(value));

  useEffect(() => {
    setDraft(formatCurrency(value));
  }, [value]);

  function commit(raw: string) {
    let n = parseBrazilianNumber(raw.replace(/[^\d.,-]/g, ""));
    if (max != null) n = Math.min(max, n);
    n = Math.max(min, n);
    onChange(n);
  }

  return (
    <div className={className}>
      <Label htmlFor={id} className="text-slate-200">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        className={cn(
          "mt-1 border-slate-600 bg-slate-950/80 text-base text-slate-100",
          highlight && "text-lg font-semibold",
        )}
      />
      {help ? <p className="mt-1 text-xs text-slate-400">{help}</p> : null}
    </div>
  );
}
