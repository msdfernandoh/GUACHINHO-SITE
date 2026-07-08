"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createListaConvidadosAction } from "@/app/admin/eventos/listas-convidados/actions";
import type { GuestDraft } from "@/lib/comercial-eventos/listas-convidados-types";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { formatWhatsappBrInput } from "@/lib/utils/format";

const emptyGuest = (): GuestDraft => ({
  nome: "",
  empresa: "",
  telefone: "",
  convidado_por: "",
});

type Props = {
  eventos: { id: string; nome: string }[];
  defaultConsultorNome: string;
  prefillEventoId?: string;
};

export function ListaConvidadosCreateForm({ eventos, defaultConsultorNome, prefillEventoId }: Props) {
  const [eventoId, setEventoId] = useState(prefillEventoId ?? "");
  const [consultorNome, setConsultorNome] = useState(defaultConsultorNome);
  const [convidados, setConvidados] = useState<GuestDraft[]>([emptyGuest()]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const updateGuest = (index: number, field: keyof GuestDraft, value: string) => {
    setConvidados((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addGuest = () => {
    setConvidados((rows) => [...rows, emptyGuest()]);
  };

  const removeGuest = (index: number) => {
    setConvidados((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const handleSubmit = () => {
    setErro(null);
    startTransition(async () => {
      try {
        await createListaConvidadosAction({
          evento_id: eventoId,
          consultor_nome: consultorNome,
          convidados,
        });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  };

  return (
    <div className="space-y-6 rounded-xl border bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Evento *</Label>
          <Select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="mt-1"
          >
            <option value="">Selecione…</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Consultor *</Label>
          <Input
            value={consultorNome}
            onChange={(e) => setConsultorNome(e.target.value)}
            className="mt-1"
            placeholder="Nome do consultor responsável pela lista"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Convidados</p>
          <p className="text-xs text-zinc-500">Preencha o primeiro e use + para incluir os demais</p>
        </div>

        {convidados.map((guest, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-12 sm:items-end"
          >
            <div className="sm:col-span-3">
              <Label className="text-xs">Nome *</Label>
              <Input
                value={guest.nome}
                onChange={(e) => updateGuest(index, "nome", e.target.value)}
                className="mt-1 h-9"
                placeholder="Nome completo"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && index === convidados.length - 1 && guest.nome.trim()) {
                    e.preventDefault();
                    addGuest();
                  }
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Empresa</Label>
              <Input
                value={guest.empresa}
                onChange={(e) => updateGuest(index, "empresa", e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={guest.telefone}
                onChange={(e) => updateGuest(index, "telefone", formatWhatsappBrInput(e.target.value))}
                className="mt-1 h-9"
                inputMode="tel"
              />
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs">Convidado por</Label>
            <Input
              value={guest.convidado_por}
              onChange={(e) => updateGuest(index, "convidado_por", e.target.value)}
              className="mt-1 h-9"
              placeholder="Vazio = nome do consultor"
            />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={convidados.length <= 1}
                onClick={() => removeGuest(index)}
                aria-label="Remover convidado"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addGuest}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar convidado
        </Button>
      </div>

      {erro ? <p className="text-sm text-red-600 dark:text-red-400">{erro}</p> : null}

      <div className="flex flex-wrap gap-2 border-t pt-4 dark:border-zinc-800">
        <Button type="button" variant="gold" disabled={pending} onClick={handleSubmit}>
          {pending ? "Salvando lista…" : "Salvar e abrir lista"}
        </Button>
      </div>
    </div>
  );
}
