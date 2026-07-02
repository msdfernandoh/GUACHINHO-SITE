"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label, Textarea, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { TIPOS_CREDITO_PUBLICO } from "@/lib/leads/tipo-credito";
import { MoneyInput } from "@/components/ui/money-input";

type IndicadoForm = {
  id: string;
  nome: string;
  whatsapp: string;
  tipoCredito: string;
  valorCredito: number | null;
  observacao: string;
};

function emptyIndicado(): IndicadoForm {
  return {
    id: crypto.randomUUID(),
    nome: "",
    whatsapp: "",
    tipoCredito: "",
    valorCredito: null,
    observacao: "",
  };
}

export function IndicacaoForm() {
  const [indicadorNome, setIndicadorNome] = useState("");
  const [indicadorEmpresa, setIndicadorEmpresa] = useState("");
  const [indicados, setIndicados] = useState<IndicadoForm[]>(() => [emptyIndicado()]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function updateIndicado(id: string, patch: Partial<IndicadoForm>) {
    setIndicados((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setSucesso(null);
    try {
      const res = await fetch("/api/public/leads/indicacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicadorNome,
          indicadorEmpresa: indicadorEmpresa || undefined,
          indicados: indicados.map(({ nome, whatsapp, tipoCredito, valorCredito, observacao }) => ({
            nome,
            whatsapp,
            tipoCredito: tipoCredito || undefined,
            valorCredito: valorCredito ?? undefined,
            observacao: observacao || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar");
      setSucesso(
        `${data.count} indicação(ões) registrada(s). Obrigado — nossa equipe entrará em contato com os indicados.`,
      );
      setIndicados([emptyIndicado()]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    indicadorNome.trim().length > 0 &&
    indicados.every((i) => i.nome.trim() && digitsOnlyPhone(i.whatsapp).length >= 10);

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 pb-24">
      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-bold text-white">Quem indicou</h2>
        <div>
          <Label>Nome de quem indicou *</Label>
          <Input
            required
            value={indicadorNome}
            onChange={(e) => setIndicadorNome(e.target.value)}
            className={cn("mt-1", surfaceInputDarkSlate)}
          />
        </div>
        <div>
          <Label>Empresa de quem indicou</Label>
          <Input
            value={indicadorEmpresa}
            onChange={(e) => setIndicadorEmpresa(e.target.value)}
            className={cn("mt-1", surfaceInputDarkSlate)}
          />
        </div>
      </section>

      {indicados.map((ind, index) => (
        <section
          key={ind.id}
          className="relative space-y-4 rounded-2xl border border-amber-500/20 bg-zinc-900/40 p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-amber-200">Indicado {index + 1}</h2>
            {indicados.length > 1 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400"
                onClick={() => setIndicados((list) => list.filter((x) => x.id !== ind.id))}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </button>
            ) : null}
          </div>
          <div>
            <Label>Nome do indicado *</Label>
            <Input
              required
              value={ind.nome}
              onChange={(e) => updateIndicado(ind.id, { nome: e.target.value })}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
          <div>
            <Label>Telefone / WhatsApp *</Label>
            <Input
              required
              inputMode="tel"
              value={ind.whatsapp}
              onChange={(e) => updateIndicado(ind.id, { whatsapp: formatWhatsappBrInput(e.target.value) })}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
          <div>
            <Label>Tipo de crédito</Label>
            <select
              value={ind.tipoCredito}
              onChange={(e) => updateIndicado(ind.id, { tipoCredito: e.target.value })}
              className={cn("mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white")}
            >
              <option value="">Selecione…</option>
              {TIPOS_CREDITO_PUBLICO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Valor do crédito</Label>
            <MoneyInput
              value={ind.valorCredito}
              onValueChange={(v) => updateIndicado(ind.id, { valorCredito: v })}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={ind.observacao}
              onChange={(e) => updateIndicado(ind.id, { observacao: e.target.value })}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
        </section>
      ))}

      <Button
        type="button"
        variant="outlineGold"
        className="w-full border-dashed"
        onClick={() => setIndicados((list) => [...list, emptyIndicado()])}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar outra indicação
      </Button>

      {erro ? <p className="text-sm text-red-400">{erro}</p> : null}
      {sucesso ? <p className="text-sm text-emerald-400">{sucesso}</p> : null}

      <Button type="submit" variant="gold" disabled={loading || !canSubmit} className="min-h-12 w-full text-base">
        {loading ? "Enviando…" : "Enviar indicações"}
      </Button>
    </form>
  );
}
