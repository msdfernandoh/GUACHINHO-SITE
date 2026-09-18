"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { labelOrigem, valorEstimadoLead, mapLegacyStatusToEtapaSlug } from "@/lib/crm/constants";
import type { LeadListRow, CrmFunilEtapaRow } from "@/lib/crm/types";
import {
  MessageCircle,
  Clock,
  Flame,
  AlertCircle,
  ExternalLink,
  CalendarPlus,
  Send,
  User,
  ArrowRight,
} from "lucide-react";
import { useState, useTransition } from "react";
import { converterLeadParaErpAction } from "@/app/admin/leads/actions";

export function CrmLeadCard({
  lead,
  etapas,
  onMoveStage,
  onDragStart,
  currentTime,
}: {
  lead: LeadListRow;
  etapas: CrmFunilEtapaRow[];
  onMoveStage: (lead: LeadListRow, targetEtapa: CrmFunilEtapaRow) => void;
  onDragStart: (e: React.DragEvent, lead: LeadListRow) => void;
  currentTime?: number | null;
}) {
  const [isConverting, startConverting] = useTransition();
  const [erpFeedback, setErpFeedback] = useState<string | null>(null);

  const valor = valorEstimadoLead(lead);
  const rawPhone = lead.whatsapp || "";
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const whatsappUrl = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}?text=${encodeURIComponent(
        `Olá ${lead.nome}, tudo bem? Sou da Gauchinho Consórcios | Racon e estou retornando seu contato!`,
      )}`
    : null;

  // Cálculo de inatividade (usando currentTime injetado para pureza de render)
  const lastInteraction = lead.ultima_interacao_at || lead.created_at;
  const hoursSinceInteraction =
    currentTime && lastInteraction
      ? (currentTime - new Date(lastInteraction).getTime()) / (1000 * 60 * 60)
      : 0;

  const isParado24h = hoursSinceInteraction >= 24 && !lead.fechado;
  const isParado7d = hoursSinceInteraction >= 168 && !lead.fechado;

  // Fase atual do lead
  const mappedSlug = mapLegacyStatusToEtapaSlug(lead.status);
  const currentEtapa = etapas.find(
    (e) =>
      e.id === lead.etapa_id ||
      e.slug === mappedSlug ||
      e.slug === lead.status ||
      e.nome.toLowerCase() === (lead.status ?? "").toLowerCase(),
  );

  const canSendToErp =
    currentEtapa?.slug === "documentacao_cadastro" ||
    currentEtapa?.slug === "boleto_enviado" ||
    currentEtapa?.slug === "venda_fechada" ||
    lead.fechado;

  function handleSendToErp(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startConverting(async () => {
      try {
        const res = await converterLeadParaErpAction(lead.id);
        if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
        }
      } catch (err) {
        setErpFeedback(err instanceof Error ? err.message : "Erro ao enviar para o ERP");
      }
    });
  }

  return (
    <article
      draggable={true}
      onDragStart={(e) => onDragStart(e, lead)}
      className="group relative flex cursor-grab flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/90 p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-md active:cursor-grabbing"
    >
      {/* 1. TOPO DO CARD: Nome e Badges */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="font-semibold text-zinc-100 hover:text-blue-400"
        >
          {lead.nome}
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {lead.is_incompleto && (
            <span
              title="Lead com cadastro incompleto — enriqueça com dados de contato"
              className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300"
            >
              Incompleto
            </span>
          )}

          {lead.temperatura && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                lead.temperatura === "Urgente" || lead.temperatura === "Muito quente"
                  ? "bg-red-500/20 text-red-400"
                  : lead.temperatura === "Quente"
                  ? "bg-orange-500/20 text-orange-400"
                  : lead.temperatura === "Morno"
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {lead.temperatura.includes("Quente") || lead.temperatura === "Urgente" ? "🔥 " : ""}
              {lead.temperatura}
            </span>
          )}
        </div>
      </div>

      {/* 2. VALOR ESTIMADO E PRODUTO */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-emerald-400">
          {valor > 0 ? formatCurrency(valor) : "Crédito a definir"}
        </span>
        <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 capitalize">
          {lead.produto_interesse || lead.tipo_interesse || "Consórcio"}
        </span>
      </div>

      {/* 3. ORIGEM E INDICAÇÃO */}
      <div className="mt-2 text-[11px] text-zinc-400">
        <p className="truncate">
          Origem: <span className="text-zinc-300">{labelOrigem(lead.origem)}</span>
        </p>
        {lead.parceiro_indicador_nome && (
          <p className="mt-0.5 truncate text-[10px] text-amber-300/80">
            Indicado por: {lead.parceiro_indicador_nome}
          </p>
        )}
      </div>

      {/* 4. RESPONSÁVEL E PRÓXIMA AÇÃO */}
      <div className="mt-2.5 space-y-1 border-t border-zinc-800/60 pt-2 text-[10px]">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <User className="h-3 w-3 text-zinc-500" />
          <span className="truncate">{lead.srd_responsavel_nome || "Sem responsável"}</span>
        </div>

        {lead.proxima_acao ? (
          <div className="flex items-center gap-1.5 text-blue-300">
            <Clock className="h-3 w-3 shrink-0 text-blue-400" />
            <span className="truncate font-medium">{lead.proxima_acao}</span>
          </div>
        ) : (
          <p className="text-zinc-600 italic">Sem próxima ação definida</p>
        )}
      </div>

      {/* 5. ALERTA DE INATIVIDADE */}
      {isParado7d ? (
        <div className="mt-2 flex items-center gap-1 rounded bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-300">
          <AlertCircle className="h-3 w-3 text-red-400" />
          <span>Parado há mais de 7 dias</span>
        </div>
      ) : isParado24h ? (
        <div className="mt-2 flex items-center gap-1 rounded bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-300">
          <Clock className="h-3 w-3 text-amber-400" />
          <span>Sem contato &gt;24h</span>
        </div>
      ) : null}

      {/* Feedback de erro ERP */}
      {erpFeedback && (
        <p className="mt-2 text-[10px] text-red-400">{erpFeedback}</p>
      )}

      {/* 6. BARRA DE AÇÕES RÁPIDAS NO RODAPÉ DO CARD */}
      <div className="mt-3 flex items-center justify-between gap-1 border-t border-zinc-800/80 pt-2">
        <div className="flex items-center gap-1">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Chamar no WhatsApp"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}

          <Link
            href={`/admin/agenda/novo?lead_id=${lead.id}&titulo=${encodeURIComponent(`Reunião: ${lead.nome}`)}`}
            title="Agendar Reunião na Agenda"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-400 transition hover:bg-purple-500/20 hover:text-purple-300"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {/* Botão Enviar para ERP quando qualificado/fechado */}
          {canSendToErp && (
            <button
              onClick={handleSendToErp}
              disabled={isConverting}
              title="Enviar lead para formalização no ERP"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600/20 px-2 py-1 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-600/40"
            >
              <Send className="h-3 w-3" />
              {isConverting ? "Enviando..." : "Para ERP"}
            </button>
          )}

          {/* Seletor rápido de coluna/etapa (fallback para acessibilidade/mobile) */}
          <select
            value={currentEtapa?.id || ""}
            onChange={(e) => {
              const target = etapas.find((st) => st.id === e.target.value);
              if (target) onMoveStage(lead, target);
            }}
            onClick={(e) => e.stopPropagation()}
            title="Mover para outra etapa"
            className="h-7 rounded border border-zinc-700 bg-zinc-950 px-1.5 text-[10px] text-zinc-300 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="" disabled>
              Mover →
            </option>
            {etapas.map((st) => (
              <option key={st.id} value={st.id}>
                {st.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}
