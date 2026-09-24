"use client";

import { useActionState } from "react";
import { CpfLoginInput } from "../login/cpf-login-input";
import { recuperarSenhaIndicadorPorCpfAction } from "./actions";
import type { RecuperarSenhaState } from "@/app/(auth)/esqueci-senha/actions";

export function CpfRecoveryForm() {
  const [state, formAction, pending] = useActionState(
    recuperarSenhaIndicadorPorCpfAction,
    null as RecuperarSenhaState | null,
  );
  return <form action={formAction} className="mt-6">
    <label className="text-sm font-bold" htmlFor="cpf-recuperacao">CPF cadastrado</label>
    <CpfLoginInput id="cpf-recuperacao" somenteCpf />
    {state && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{state.message}</p>}
    {!state?.ok && <button type="submit" disabled={pending} className="mt-4 w-full rounded-2xl bg-zinc-950 p-4 font-bold text-white disabled:opacity-60">{pending ? "Enviando..." : "Enviar link de recuperação"}</button>}
  </form>;
}
