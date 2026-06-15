"use client";

import { cn } from "@/lib/utils/cn";
import { Input, Label } from "@/components/ui/form-primitives";
import { fieldHelpClass } from "./simulador-ui";

type Props = {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
  step?: number;
  min?: number;
  max?: number;
};

export function PercentInput({
  id,
  label,
  value,
  onChange,
  help,
  step = 0.001,
  min = 0,
  max,
}: Props) {
  return (
    <div>
      <Label htmlFor={id} className="text-slate-200">
        {label}
      </Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            let n = Number(e.target.value);
            if (!Number.isFinite(n)) n = 0;
            if (max != null) n = Math.min(max, n);
            onChange(Math.max(min, n));
          }}
          className="border-slate-600 bg-slate-950/80 pr-10 text-slate-100"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          %
        </span>
      </div>
      {help ? <p className={fieldHelpClass()}>{help}</p> : null}
    </div>
  );
}
