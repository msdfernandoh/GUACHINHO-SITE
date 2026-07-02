"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatBRL, maskBRLMoneyInput, parseBRLMoney } from "@/lib/formatters/money";
import { Input } from "@/components/ui/form-primitives";

type MoneyInputProps = {
  value: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  inputMode?: "decimal" | "numeric";
};

export function MoneyInput({
  value,
  onValueChange,
  placeholder = "R$ 0,00",
  disabled,
  required,
  name,
  id,
  className,
  inputMode = "numeric",
}: MoneyInputProps) {
  const [display, setDisplay] = useState(() => (value != null ? formatBRL(value) : ""));

  useEffect(() => {
    const formatted = value != null ? formatBRL(value) : "";
    setDisplay((prev) => {
      const parsedPrev = parseBRLMoney(prev);
      if (parsedPrev === value && prev === formatted) return prev;
      if (value == null && prev === "") return prev;
      return formatted;
    });
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskBRLMoneyInput(e.target.value);
    setDisplay(masked);
    onValueChange(parseBRLMoney(masked));
  }

  function handleBlur() {
    if (value != null) setDisplay(formatBRL(value));
    else setDisplay("");
  }

  return (
    <Input
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      inputMode={inputMode}
      value={display}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}
