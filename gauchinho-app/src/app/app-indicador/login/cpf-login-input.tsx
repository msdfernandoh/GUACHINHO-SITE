"use client";

import { useState } from "react";
import { formatCpfBrInput } from "@/lib/utils/format";

export function CpfLoginInput() {
  const [identificador, setIdentificador] = useState("");
  const atualizar = (valor: string) => {
    setIdentificador(valor.includes("@") || /[a-z]/i.test(valor) ? valor : formatCpfBrInput(valor));
  };
  return <input name="identificador" inputMode={identificador.includes("@") ? "email" : "numeric"} autoComplete="username" required placeholder="CPF ou e-mail" value={identificador} onChange={(event) => atualizar(event.target.value)} className="mt-6 w-full rounded-2xl border p-4" />;
}
