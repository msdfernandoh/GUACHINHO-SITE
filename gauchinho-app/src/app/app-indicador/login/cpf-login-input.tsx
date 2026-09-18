"use client";

import { useState } from "react";
import { formatCpfBrInput } from "@/lib/utils/format";

export function CpfLoginInput() {
  const [cpf, setCpf] = useState("");
  return <input name="cpf" inputMode="numeric" autoComplete="username" required placeholder="CPF" value={cpf} onChange={(event) => setCpf(formatCpfBrInput(event.target.value))} className="mt-6 w-full rounded-2xl border p-4" />;
}
