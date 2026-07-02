"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";
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
  const [draft, setDraft] = useState(() => formatBRL(value));

  useEffect(() => {
    setDraft(formatBRL(value));
  }, [value]);

  function commitFromDisplay(raw: string) {
    let n = parseBRLMoney(raw) ?? 0;
    if (max != null) n = Math.min(max, n);
    n = Math.max(min, n);
    onChange(n);
    setDraft(formatBRL(n));
  }

  return (
    <div className={className}>
      <Label htmlFor={id} className="text-slate-200">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const masked = maskBRLMoneyInput(e.target.value);
          setDraft(masked);
          const parsed = parseBRLMoney(masked);
          if (parsed != null) {
            let n = parsed;
            if (max != null) n = Math.min(max, n);
            n = Math.max(min, n);
            onChange(n);
          }
        }}
        onBlur={() => commitFromDisplay(draft)}
        className={cn(
          "mt-1 border-slate-600 bg-slate-950/80 text-base text-slate-100",
          highlight && "text-lg font-semibold",
        )}
      />
      {help ? <p className="mt-1 text-xs text-slate-400">{help}</p> : null}
    </div>
  );
}
