"use client";

import { useState, useTransition } from "react";
import { publicAddConvidadoListaAction } from "@/app/(public)/lista-convidados/public-actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import type { PublicListaConvidadosView } from "@/lib/comercial-eventos/listas-convidados-public";

export function ListaConvidadosPublicForm({ lista }: { lista: PublicListaConvidadosView }) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [convidadoPor, setConvidadoPor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const res = await publicAddConvidadoListaAction(lista.slug, {
        nome,
        empresa,
        telefone,
        convidado_por: convidadoPor,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setMsg(`${nome.trim()} incluído na lista. Obrigado!`);
      setNome("");
      setEmpresa("");
      setTelefone("");
      setConvidadoPor("");
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-5 shadow-xl sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">Cadastro de convidados</p>
      <h1 className="mt-2 text-xl font-bold text-white">{lista.evento_nome}</h1>
      <p className="mt-1 text-sm text-slate-400">
        Consultor: <span className="text-slate-200">{lista.consultor_nome}</span>
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <Label className="text-slate-200">Nome *</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 border-slate-600 bg-slate-950 text-white"
            placeholder="Nome completo"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-200">Empresa</Label>
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="mt-1 border-slate-600 bg-slate-950 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-200">Telefone / WhatsApp</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
              className="mt-1 border-slate-600 bg-slate-950 text-white"
              inputMode="tel"
            />
          </div>
        </div>
        <div>
          <Label className="text-slate-200">Convidado por</Label>
          <Input
            value={convidadoPor}
            onChange={(e) => setConvidadoPor(e.target.value)}
            className="mt-1 border-slate-600 bg-slate-950 text-white"
            placeholder={`Opcional — padrão: ${lista.consultor_nome}`}
          />
        </div>
      </div>

      {erro ? <p className="mt-3 text-sm text-red-400">{erro}</p> : null}
      {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}

      <Button
        type="button"
        variant="gold"
        className="mt-5 w-full min-h-11"
        disabled={pending || !nome.trim()}
        onClick={submit}
      >
        {pending ? "Enviando…" : "Incluir na lista"}
      </Button>
    </div>
  );
}
