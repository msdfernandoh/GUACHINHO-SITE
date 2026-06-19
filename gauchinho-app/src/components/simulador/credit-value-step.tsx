import { formatCurrency } from "@/lib/utils/format";
import { sectionCardClass, stepBadgeClass } from "./simulador-ui";
import { CurrencyInput } from "./currency-input";
import { cn } from "@/lib/utils/cn";

type Props = {
  stepNumber?: number;
  title: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function CreditValueStep({
  stepNumber = 3,
  title,
  valueLabel,
  value,
  min,
  max,
  step = 1000,
  onChange,
}: Props) {
  const sliderValue = Math.min(max, Math.max(min, value));

  return (
    <section className={sectionCardClass()}>
      <div className="mb-5 flex items-start gap-3">
        <span className={stepBadgeClass()}>{stepNumber}</span>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{valueLabel}</p>
        </div>
      </div>
      <p className="text-center text-3xl font-extrabold tracking-tight text-amber-400 sm:text-4xl">
        {formatCurrency(value)}
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "mt-6 h-3 w-full cursor-pointer appearance-none rounded-full bg-slate-800",
          "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-lg",
        )}
        aria-label={valueLabel}
      />
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{formatCurrency(min)}</span>
        <span>{formatCurrency(max)}</span>
      </div>
      <div className="mt-5">
        <CurrencyInput
          label="Ou digite o valor"
          value={value}
          min={min}
          max={max}
          onChange={onChange}
        />
      </div>
    </section>
  );
}
