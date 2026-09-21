"use client";

import { useState, useEffect } from "react";
import { MOTIVOS_PERDA, LEAD_TEMPERATURES } from "@/lib/crm/constants";
import { X, ArrowRight, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import type { LeadListRow, CrmFunilEtapaRow } from "@/lib/crm/types";

export function CrmStageMoveModal({
  lead,
  targetEtapa,
  onConfirm,
  onCancel,
  isPending,
}: {
  lead: LeadListRow;
  targetEtapa: CrmFunilEtapaRow;
  onConfirm: (payload: {
    proximaAcao?: string;
    dataProximaAcao?: string;
    observacao?: string;
    motivoPerda?: string;
    temperatura?: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const isLost = targetEtapa.is_lost || targetEtapa.slug === "perdido";
  const isWon = targetEtapa.is_won || targetEtapa.slug === "venda_fechada";
  const [motivoPerda, setMotivoPerda] = useState("Sem interesse");
  const [observacao, setObservacao] = useState("");
  const [proximaAcao, setProximaAcao] = useState(lead.proxima_acao || "");
  const [dataRetorno, setDataRetorno] = useState(lead.proximo_retorno_data || "");
  const [temperatura, setTemperatura] = useState(lead.temperatura || "Quente");
  const [definirRetorno, setDefinirRetorno] = useState(!isLost && !isWon);

  useEffect(() => {
    if (!lead.proximo_retorno_data) {
      const defaultDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setDataRetorno(defaultDate);
    }
  }, [lead.proximo_retorno_data]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onConfirm({
      proximaAcao: definirRetorno && !isLost ? proximaAcao || "Retornar contato" : undefined,
      dataProximaAcao: definirRetorno && !isLost ? dataRetorno : undefined,
      observacao: observacao.trim() || undefined,
      motivoPerda: isLost ? motivoPerda : undefined,
      temperatura: !isLost ? temperatura : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {isLost ? (
            <AlertTriangle className="h-5 w-5 text-red-400" />
          ) : isWon ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-blue-400" />
          )}
          <h2 className="text-base font-bold text-zinc-100">
            {isLost
              ? "Marcar Lead como Perdido"
              : isWon
              ? "Marcar Lead como Venda Fechada"
              : "Atualizar Etapa do Lead"}
          </h2>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
          <p className="font-semibold text-zinc-200">{lead.nome}</p>
          <div className="mt-1 flex items-center gap-1.5 text-zinc-400">
            <span className="text-zinc-500">{lead.status}</span>
            <ArrowRight className="h-3 w-3 text-zinc-500" />
            <span className="font-bold" style={{ color: targetEtapa.cor }}>
              {targetEtapa.nome}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3.5">
          {isWon && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200">
              <p className="font-semibold text-emerald-300">🏆 Transição para Venda Fechada</p>
              <p className="mt-1 text-emerald-300/80">
                O lead será atualizado para a etapa de Venda Fechada sem obrigatoriedade de proposta ou burocracia de fechamento prévio.
              </p>
            </div>
          )}
          {/* Se for Perdido, exige motivo de perda */}
          {isLost ? (
            <div>
              <label className="block text-xs font-semibold text-red-300">
                Motivo da Perda <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                className="mt-1 w-full rounded-lg border border-red-500/40 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-red-500 focus:outline-hidden"
              >
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              {/* Opções de próximo passo */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-300">
                  <input
                    type="checkbox"
                    checked={definirRetorno}
                    onChange={(e) => setDefinirRetorno(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                  />
                  Registrar próximo passo / retorno
                </label>

                {definirRetorno && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-400">O que fazer:</label>
                      <input
                        type="text"
                        placeholder="Ex: Retornar proposta, Agendar reunião online..."
                        value={proximaAcao}
                        onChange={(e) => setProximaAcao(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-zinc-400">Data do retorno:</label>
                        <input
                          type="date"
                          value={dataRetorno}
                          onChange={(e) => setDataRetorno(e.target.value)}
                          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400">Temperatura:</label>
                        <select
                          value={temperatura}
                          onChange={(e) => setTemperatura(e.target.value)}
                          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-hidden"
                        >
                          {LEAD_TEMPERATURES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Observações da mudança */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300">
              Observação / Comentário (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Adicionar nota sobre a conversa ou motivo da mudança..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className={`text-xs font-semibold text-white shadow ${
                isLost
                  ? "bg-red-600 hover:bg-red-500"
                  : isWon
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {isPending ? "Salvando..." : isWon ? "Confirmar Fechamento" : "Confirmar Mudança"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
