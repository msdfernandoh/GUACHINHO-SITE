"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { salvarHerancaEventoAction } from "./actions";

export type HerancaEventoFormValues = {
  data: string;
  hora: string;
  vagas: number | null;
  local: string;
  endereco: string;
  cidade: string;
  estado: string;
};

export function HerancaEventoForm({ inicial }: { inicial: HerancaEventoFormValues }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function enviar(fd: FormData) {
    setMsg(null);
    iniciar(async () => {
      const r = await salvarHerancaEventoAction(fd);
      if (r.ok) {
        setMsg({ ok: true, texto: "Salvo! A página e a inscrição já mostram os novos dados." });
        router.refresh();
      } else {
        setMsg({ ok: false, texto: r.error });
      }
    });
  }

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="h-data">Dia</Label>
        <Input id="h-data" name="data" type="date" defaultValue={inicial.data} required />
      </div>
      <div>
        <Label htmlFor="h-hora">Horário</Label>
        <Input id="h-hora" name="hora" type="time" defaultValue={inicial.hora} required />
      </div>
      <div>
        <Label htmlFor="h-vagas">Vagas</Label>
        <Input id="h-vagas" name="vagas" type="number" min={1} defaultValue={inicial.vagas ?? ""} required />
        <p className="mt-1 text-xs text-zinc-500">Depois do limite, a inscrição entra na lista de espera e a pessoa é avisada de que haverá um novo encontro.</p>
      </div>
      <div>
        <Label htmlFor="h-local">Local</Label>
        <Input id="h-local" name="local" defaultValue={inicial.local} placeholder="Ex.: Auditório da UniFECAF" required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="h-end">Endereço</Label>
        <Input id="h-end" name="endereco" defaultValue={inicial.endereco} placeholder="Ex.: Av. Embaúbas, 2114 - Setor Comercial" />
      </div>
      <div>
        <Label htmlFor="h-cidade">Cidade</Label>
        <Input id="h-cidade" name="cidade" defaultValue={inicial.cidade} />
      </div>
      <div>
        <Label htmlFor="h-uf">Estado (UF)</Label>
        <Input id="h-uf" name="estado" defaultValue={inicial.estado} maxLength={2} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="gold" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar dia, horário, vagas e local"}
        </Button>
        {msg ? <span className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.texto}</span> : null}
      </div>
    </form>
  );
}
