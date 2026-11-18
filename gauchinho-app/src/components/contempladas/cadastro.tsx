"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cadastroConviteAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { createClient } from "@/lib/supabase/client";
import { btnOuro, Card, inputCls, TelInput } from "./ui";

export function CadastroConvite({ token, papel }: { token: string; papel: "GERENTE" | "VENDEDOR" }) {
  const router = useRouter();
  const [f, setF] = useState({ nome: "", email: "", telefone: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();
  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-lg font-bold">Cadastro de {papel === "GERENTE" ? "gerente" : "vendedor"}</h1>
      <p className="mb-4 text-sm text-slate-500">Acesso ao portal de cotas contempladas.</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          start(async () => {
            const r = await cadastroConviteAction(token, f);
            if (!r.ok) return setErro(r.erro);
            await createClient().auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.senha });
            router.push("/contempladas/painel");
            router.refresh();
          });
        }}
      >
        <input className={inputCls} placeholder="Nome completo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
        <input className={inputCls} type="email" placeholder="E-mail (será seu login)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <TelInput value={f.telefone} onChange={(v) => setF({ ...f, telefone: v })} required />
        <input className={inputCls} type="password" placeholder="Senha (mín. 8)" minLength={8} value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} required />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnOuro} w-full`} disabled={pend}>{pend ? "Cadastrando…" : "Criar acesso"}</button>
      </form>
    </Card>
  );
}
