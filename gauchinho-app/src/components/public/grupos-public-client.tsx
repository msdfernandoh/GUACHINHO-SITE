"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PublicGrupoAggregate } from "@/lib/types";
import { MODALIDADE_FILTRO_PUBLICO } from "@/lib/types";
import {
  agregarResultadosLinhas,
  calcularLinhaSimulacaoGrupo,
  defaultConfigLinha,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { digitsOnlyPhone, formatCurrency, formatWhatsappBrInput } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, surfaceInputDark } from "@/components/ui/form-primitives";
import { GrupoMobileCard } from "@/components/public/grupos/grupo-mobile-card";
import { GrupoTotalsBar } from "@/components/public/grupos/grupo-totals-bar";
import { GruposTable } from "@/components/public/grupos/grupos-table";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";
import { PropostaLinkModal } from "@/components/contratacao/proposta-link-modal";
import { useIniciarContratacao } from "@/lib/contratacoes-online/use-iniciar-contratacao";
import { buildDadosSimulacaoGrupos } from "@/lib/contratacoes-online/build-grupos-payload";
import { GruposSorteioPublicSection } from "@/components/grupos-sorteio/grupos-sorteio-admin-client";
import type { GrupoSorteioOption } from "@/components/grupos-sorteio/grupos-sorteio-panel";

type ModalFiltro = (typeof MODALIDADE_FILTRO_PUBLICO)[number]["value"];

export type SelecaoGrupoPayload = {
  grupoId: string;
  cotaId: string;
  config: ConfigLinhaSimulacaoGrupo;
  resultado: ReturnType<typeof calcularLinhaSimulacaoGrupo>;
};

export function GruposPublicClient({
  aggregates,
  isStaff = false,
  isConsultor = false,
  gruposSorteio = [],
  canManageSorteios = false,
}: {
  aggregates: PublicGrupoAggregate[];
  isStaff?: boolean;
  isConsultor?: boolean;
  gruposSorteio?: GrupoSorteioOption[];
  canManageSorteios?: boolean;
}) {
  const [filtro, setFiltro] = useState<ModalFiltro>("Todos");
  const [busca, setBusca] = useState("");
  const [configs, setConfigs] = useState<Record<string, ConfigLinhaSimulacaoGrupo>>(() => {
    const init: Record<string, ConfigLinhaSimulacaoGrupo> = {};
    aggregates.forEach(({ grupo, cotas, modalidades }) => {
      init[grupo.id] = defaultConfigLinha(grupo, cotas, modalidades);
    });
    return init;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{
    protocolo: string;
    url: string;
    credito: number | null;
    parcela: number | null;
    tipoBem: string | null;
  } | null>(null);
  const { iniciar: iniciarContratacao, loading: contratacaoLoading } = useIniciarContratacao();

  const modalCancelClass =
    "border-zinc-500 bg-zinc-900 text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800 hover:text-zinc-100";

  useLockBodyScroll(modalOpen);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return aggregates.filter(({ grupo, cotas }) => {
      if (!cotas.length) return false;
      if (filtro !== "Todos" && grupo.modalidade !== filtro) return false;
      if (!q) return true;
      return (
        grupo.codigo_grupo.toLowerCase().includes(q) ||
        cotas.some((c) => String(c.valor_credito).includes(q.replace(",", ".")))
      );
    });
  }, [aggregates, filtro, busca]);

  const linhasAtivas = useMemo(() => {
    const out: SelecaoGrupoPayload[] = [];
    aggregates.forEach(({ grupo, cotas, modalidades }) => {
      const config = configs[grupo.id];
      if (!config) return;
      const cota = cotas.find((c) => c.id === config.cotaId);
      const resultado = calcularLinhaSimulacaoGrupo({
        grupo,
        cota: cota ?? null,
        config,
        modalidades,
      });
      if (resultado.ativo && cota) {
        out.push({ grupoId: grupo.id, cotaId: cota.id, config, resultado });
      }
    });
    return out;
  }, [aggregates, configs]);

  const totais = useMemo(
    () => agregarResultadosLinhas(linhasAtivas.map((l) => l.resultado)),
    [linhasAtivas],
  );

  const hasSelection = linhasAtivas.length > 0;

  function setConfig(grupoId: string, config: ConfigLinhaSimulacaoGrupo) {
    setConfigs((prev) => ({ ...prev, [grupoId]: config }));
  }

  const linhasEnriquecidas = useMemo(() => {
    return linhasAtivas.map((l) => {
      const agg = aggregates.find((a) => a.grupo.id === l.grupoId);
      return {
        ...l,
        grupo: agg?.grupo ?? aggregates[0]?.grupo,
      };
    }).filter((l) => l.grupo);
  }, [linhasAtivas, aggregates]);

  function buildPayloadGrupos() {
    return buildDadosSimulacaoGrupos(
      linhasEnriquecidas.map((l) => ({
        grupoId: l.grupoId,
        cotaId: l.cotaId,
        config: l.config,
        resultado: l.resultado,
        grupo: l.grupo!,
      })),
      totais as unknown as Record<string, unknown>,
    );
  }

  async function iniciarContratacaoGrupos(modo: "cliente_site" | "sdr_link") {
    if (!hasSelection) {
      setToastMsg("Informe cota e quantidade (mín. 1) em ao menos um grupo.");
      return;
    }
    setToastMsg(null);
    try {
      const result = await iniciarContratacao({
        modo,
        origem: "grupos",
        dados_simulacao: buildPayloadGrupos(),
        cliente_pre_nome: nome.trim() || undefined,
        cliente_pre_telefone: whatsapp ? digitsOnlyPhone(whatsapp) : undefined,
        redirectCliente: modo === "cliente_site",
      });
      if (modo === "sdr_link" && result) {
        setLinkModal({
          protocolo: result.protocolo,
          url: result.url,
          credito: totais.creditoLiquido,
          parcela: totais.primeiraParcela,
          tipoBem: linhasEnriquecidas.map((l) => l.grupo?.modalidade).join(", "),
        });
      }
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Erro ao criar proposta");
    }
  }

  function openPropostaModal() {
    if (!hasSelection) {
      setToastMsg("Informe cota e quantidade (mín. 1) em ao menos um grupo.");
      return;
    }
    setModalOpen(true);
    setResultMsg(null);
    setPdfLink(null);
    setToastMsg(null);
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResultMsg(null);
    setPdfLink(null);
    try {
      const res = await fetch("/api/public/grupos/fluxo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp: digitsOnlyPhone(whatsapp),
          acao: "proposta",
          selecoes: linhasAtivas.map((s) => ({
            grupoId: s.grupoId,
            cotaId: s.cotaId,
            config: s.config,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      const pdfHref = (data.pdfPath as string) ?? (data.pdfDownloadUrl as string) ?? null;
      setPdfLink(pdfHref);
      setResultMsg(`Proposta criada. Crédito líquido: ${formatCurrency(data.creditoLiquido)}`);
      setModalOpen(false);
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        simuladorShell,
        "pb-[4.75rem] lg:pb-[18rem]",
        /* espaço extra quando o resumo mobile está expandido — evita sobrepor últimos cards */
        "max-lg:has-[button[aria-expanded=true]]:pb-[min(46vh,22rem)]",
      )}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-6">
        <PublicPremiumHero
          eyebrow="Gauchinho · Grupos"
          title="Nossos Grupos"
          subtitle="Planilha inteligente: compare grupos na linha e use Ajustar para modalidades de lance e recurso próprio."
        />

        <div className="mb-4 flex flex-wrap items-center gap-2 md:mb-5">
          {MODALIDADE_FILTRO_PUBLICO.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setFiltro(m.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition md:text-sm md:px-4 md:py-2",
                filtro === m.value
                  ? "bg-amber-500 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:border-amber-500/50",
              )}
            >
              {m.label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[200px] flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              className="h-9 border-zinc-700 bg-zinc-900 pl-9 text-sm text-zinc-100"
              placeholder="Grupo ou crédito…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <GruposSorteioPublicSection grupos={gruposSorteio} canManage={canManageSorteios} />

        {aggregates.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-16 text-center">
            <p className="text-lg text-zinc-300">Nenhum grupo disponível no momento.</p>
            {isStaff ? (
              <p className="mt-4 text-sm text-amber-400/90">
                <Link href="/admin/grupos" className="underline hover:text-amber-300">
                  Cadastre grupos no admin
                </Link>
              </p>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 px-6 py-12 text-center text-zinc-400">
            Nenhum resultado para os filtros atuais.
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <GruposTable
                rows={filtered}
                configs={configs}
                onConfigChange={setConfig}
              />
            </div>

            <div className="space-y-3 lg:hidden">
              {filtered.map(({ grupo, cotas, modalidades }) => {
                const config =
                  configs[grupo.id] ?? defaultConfigLinha(grupo, cotas, modalidades);
                return (
                  <GrupoMobileCard
                    key={grupo.id}
                    grupo={grupo}
                    cotas={cotas}
                    modalidades={modalidades}
                    config={config}
                    onChange={(c) => setConfig(grupo.id, c)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <GrupoTotalsBar
        totais={totais}
        toastMsg={toastMsg}
        resultMsg={resultMsg}
        pdfLink={pdfLink}
        onProposta={openPropostaModal}
        onContratar={() => void iniciarContratacaoGrupos("cliente_site")}
        onGerarLink={isConsultor ? () => void iniciarContratacaoGrupos("sdr_link") : undefined}
        contratarLoading={contratacaoLoading}
      />

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={submitModal}
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
          >
            <h2 className="text-lg font-semibold text-white">Seus dados</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">Nome</label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={surfaceInputDark}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">WhatsApp</label>
              <Input
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="(51) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsappBrInput(e.target.value))}
                className={surfaceInputDark}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={loading || digitsOnlyPhone(whatsapp).length < 10}>
                {loading ? "Enviando…" : "Confirmar"}
              </Button>
              <Button
                type="button"
                variant="outlineGold"
                className={modalCancelClass}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <PropostaLinkModal
        open={Boolean(linkModal)}
        onClose={() => setLinkModal(null)}
        protocolo={linkModal?.protocolo ?? ""}
        url={linkModal?.url ?? ""}
        credito={linkModal?.credito}
        parcela={linkModal?.parcela}
        tipoBem={linkModal?.tipoBem}
      />
    </div>
  );
}
