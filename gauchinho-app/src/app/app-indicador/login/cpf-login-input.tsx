"use client";

import { useState } from "react";
import { formatCpfBrInput } from "@/lib/utils/format";

export function CpfLoginInput({ id, somenteCpf = false }: { id?: string; somenteCpf?: boolean }) {
  const [identificador, setIdentificador] = useState("");
  const atualizar = (valor: string) => {
    setIdentificador(!somenteCpf && (valor.includes("@") || /[a-z]/i.test(valor)) ? valor : formatCpfBrInput(valor));
  };
  return <input id={id} name="identificador" inputMode={somenteCpf ? "numeric" : "text"} autoComplete="username" required placeholder={somenteCpf ? "CPF" : "CPF ou e-mail"} aria-label={somenteCpf ? "CPF" : "CPF ou e-mail"} value={identificador} onChange={(event) => atualizar(event.target.value)} className="mt-6 w-full rounded-2xl border p-4" />;
}
