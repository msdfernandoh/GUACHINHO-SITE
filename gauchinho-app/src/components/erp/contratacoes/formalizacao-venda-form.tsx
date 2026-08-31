"use client";

import { useState, useMemo, useTransition } from "react";
import { formalizarContratacaoAction } from "@/app/erp/contratacoes/actions";
import { Users, Calculator, UserCheck, Calendar, Info, Sparkles } from "lucide-react";

export type GrupoCota = {
  id: string;
  valor_credito: number;
  ativo?: boolean;
  status?: string;
  grupo_codigo?: string;
  modalidades: Array<{
    id: string;
    codigo: string;
    nome: string;
    valor_parcela: number;
    percentual_reducao: number | null;
  }>;
};

export type GrupoConsorcio = {
  id: string;
  codigo_grupo: string;
  administradora_id: string;
  status_governanca: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  prazo_total: number | null;
  prazo_restante: number;
  parcelas_realizadas: number | null;
  parcelas_realizadas_base: number | null;
  data_base_parcelas: string | null;
  atualizacao_parcelas_automatica: boolean;
  administradora: unknown;
  tipo: unknown;
  modalidade: unknown;
  grupos_cotas: GrupoCota[] | null;
};

export type ParticipanteComercial = {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  status: string;
  participante_tipos?: Array<{ tipo_codigo: string }>;
};

export type VinculoPerfil = {
  id: string;
  participante_id: string;
  papel_tipo: string;
  perfil_id: string;
  override_percentual: number | null;
  perfil: {
    id: string;
    nome: string;
    papel_base: string;
  } | null;
};

export type RegraParticipante = {
  id: string;
  perfil_id: string | null;
  programa_id?: string | null;
  percentual_comissao: number;
  seguir_cronograma_franquia: boolean;
  etapas_cronograma: unknown;
  base_v2: string;
  status: string;
};

export type RegraFranquia = {
  id: string;
  programa_id: string;
  percentual_total_comissao: number;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  ativa: boolean;
  configuracao_homologada?: boolean;
  etapas_cronograma?: unknown;
  comissao_regra_etapas?: unknown;
};

interface FormalizacaoVendaFormProps {
  contratacaoId: string;
  clienteNome: string;
  formaPagamento: string;
  formalizada: boolean;
  grupos: GrupoConsorcio[];
  participantes: ParticipanteComercial[];
  vinculosPerfis: VinculoPerfil[];
  regrasParticipantes: RegraParticipante[];
  regrasFranquia?: RegraFranquia[];
  initialGrupoId: string;
  initialCotaId: string;
  initialModalidadeId?: string | null;
  initialPrincipalId: string;
  initialPerfilPrincipalId?: string | null;
  initialPerfilSecundarioId?: string | null;
  initialDataPrimeiraParcela?: string | null;
  initialDataSegundaParcela?: string | null;
  initialCronogramaSecundario?: string | null;
  initialSecundarioId: string | null;
  initialFracaoSecundario: number | null;
  creditoAceito: number;
  parcelaAceita: number;
  initialQuantidadeCotas: number;
  condicaoComercialCongelada: boolean;
}

const brl = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FormalizacaoVendaForm({
  contratacaoId,
  clienteNome,
  formaPagamento,
  formalizada,
  grupos,
  participantes,
  vinculosPerfis,
  regrasParticipantes,
  regrasFranquia = [],
  initialGrupoId,
  initialCotaId,
  initialModalidadeId,
  initialPrincipalId,
  initialPerfilPrincipalId,
  initialPerfilSecundarioId,
  initialDataPrimeiraParcela,
  initialDataSegundaParcela,
  initialCronogramaSecundario,
  initialSecundarioId,
  initialFracaoSecundario,
  creditoAceito,
  parcelaAceita,
  initialQuantidadeCotas,
  condicaoComercialCongelada,
}: FormalizacaoVendaFormProps) {
  const [isPending, startTransition] = useTransition();

  const [selectedGrupoId, setSelectedGrupoId] = useState(initialGrupoId || "");
  const [selectedCotaId, setSelectedCotaId] = useState(initialCotaId || "");
  const [selectedModalidadeId, setSelectedModalidadeId] = useState<string>(initialModalidadeId || "");
  const [quantidadeCotas, setQuantidadeCotas] = useState(initialQuantidadeCotas || 1);

  // Datas de pagamento personalizadas (Adesão vs 2ª Parcela em diante)
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 2);
  nextMonthDate.setDate(10);
  const defaultSegundaData = nextMonthDate.toISOString().slice(0, 10);

  const [selectedPrincipalId, setSelectedPrincipalId] = useState(initialPrincipalId || "");
  const [selectedPerfilPrincipalId, setSelectedPerfilPrincipalId] = useState(initialPerfilPrincipalId || "");

  const [selectedSecundarioId, setSelectedSecundarioId] = useState(initialSecundarioId || "");
  const [modoSecundario, setModoSecundario] = useState<"PERFIL" | "MANUAL">(initialPerfilSecundarioId ? "PERFIL" : "MANUAL");
  const [selectedPerfilSecundarioId, setSelectedPerfilSecundarioId] = useState(initialPerfilSecundarioId || "");
  const [fracaoManualSecundario, setFracaoManualSecundario] = useState<number>(
    initialFracaoSecundario ? Number(initialFracaoSecundario) : 20
  );
  const [cronogramaSecundario, setCronogramaSecundario] = useState(initialCronogramaSecundario || "SEGUIR_PRINCIPAL");

  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(initialDataPrimeiraParcela || todayStr);
  const [dataSegundaParcela, setDataSegundaParcela] = useState(initialDataSegundaParcela || defaultSegundaData);

  // 1. Grupo e Cotas disponíveis
  const grupoAtual = useMemo(
    () => grupos.find((g) => g.id === selectedGrupoId) || null,
    [grupos, selectedGrupoId],
  );
  const cotasDisponiveis = useMemo(() => (grupoAtual?.grupos_cotas ?? []).filter((c) => c.ativo !== false), [grupoAtual]);
  const cotaAtual = useMemo(
    () => cotasDisponiveis.find((c) => c.id === selectedCotaId) || null,
    [cotasDisponiveis, selectedCotaId]
  );

  const valorCredito = creditoAceito > 0 ? creditoAceito : cotaAtual?.valor_credito || 0;
  const prazoTotal = grupoAtual?.prazo_total || 0;
  const prazoRestante = grupoAtual?.prazo_restante || 0;

  // 2. Perfis do Consultor Principal
  const perfisPrincipal = useMemo(() => {
    if (!selectedPrincipalId) return [];
    return vinculosPerfis.filter((v) => v.participante_id === selectedPrincipalId && v.perfil);
  }, [vinculosPerfis, selectedPrincipalId]);

  const perfilPrincipalAtivo = useMemo(() => {
    if (!selectedPerfilPrincipalId) return null;
    return perfisPrincipal.find((p) => p.perfil_id === selectedPerfilPrincipalId) || null;
  }, [perfisPrincipal, selectedPerfilPrincipalId]);

  // Regra do perfil comercial selecionado (contém o programa_id da franqueadora, ex: Franquia Antiga)
  const regraPrincipalAtiva = useMemo(() => {
    if (!perfilPrincipalAtivo) return null;
    return regrasParticipantes.find((r) => r.perfil_id === perfilPrincipalAtivo.perfil_id) || null;
  }, [regrasParticipantes, perfilPrincipalAtivo]);

  const programaPrincipalId = useMemo(() => {
    return regraPrincipalAtiva?.programa_id || null;
  }, [regraPrincipalAtiva]);

  // Percentual de repasse ao Consultor Principal (% sobre a comissão da Franqueadora)
  const percentualPrincipal = useMemo(() => {
    if (!perfilPrincipalAtivo) return 0;
    if (perfilPrincipalAtivo.override_percentual !== null && perfilPrincipalAtivo.override_percentual !== undefined) {
      return Number(perfilPrincipalAtivo.override_percentual);
    }
    if (regraPrincipalAtiva?.percentual_comissao !== undefined && regraPrincipalAtiva.percentual_comissao !== null) {
      return Number(regraPrincipalAtiva.percentual_comissao);
    }
    return 0;
  }, [perfilPrincipalAtivo, regraPrincipalAtiva]);

  // 3. Modalidades homologadas para a combinação exata Grupo + Produto.
  // A parcela pertence à modalidade da cota, nunca ao produto isolado.
  const modalidadesOpcoes = useMemo(() => {
    return (cotaAtual?.modalidades ?? []).map((modalidade) => {
      const regra = regrasFranquia.find((r) => {
        const matchProg = programaPrincipalId ? r.programa_id === programaPrincipalId : false;
        const matchTipo = grupoAtual?.tipo_administradora_id
          ? r.tipo_administradora_id === null || r.tipo_administradora_id === grupoAtual.tipo_administradora_id
          : r.tipo_administradora_id === null;
        const matchM = r.modalidade_comissao_id === modalidade.id;
        return matchProg && matchTipo && matchM;
      });

      const percentualRef =
        regra?.percentual_total_comissao !== undefined && regra?.percentual_total_comissao !== null
          ? Number(regra.percentual_total_comissao)
          : 0;

      const etapasCount = Array.isArray(regra?.etapas_cronograma) && regra.etapas_cronograma.length > 0
        ? regra.etapas_cronograma.length
        : Array.isArray((regra as any)?.comissao_regra_etapas) && (regra as any).comissao_regra_etapas.length > 0
        ? (regra as any).comissao_regra_etapas.length
        : 0;

      const codigo = modalidade.codigo.toUpperCase();
      const badge = codigo === "INTEGRAL"
        ? "Integral"
        : codigo.includes("60")
          ? "Reduzida 60%"
          : "Abaixo 59%";
      const badgeColor = codigo === "INTEGRAL"
        ? "bg-emerald-100 text-emerald-800"
        : codigo.includes("60")
          ? "bg-blue-100 text-blue-800"
          : "bg-amber-100 text-amber-800";

      return {
        id: modalidade.id,
        codigo: modalidade.codigo,
        nome: modalidade.nome,
        descricao: `${etapasCount ? `${etapasCount} etapas de comissão` : "Cronograma da comissão"}`,
        percentualReferencia: percentualRef,
        etapasCount,
        badge,
        badgeColor,
        isCadastradaNoBanco: true,
      };
    });
  }, [cotaAtual, regrasFranquia, grupoAtual, programaPrincipalId]);

  const modalidadeAtiva = useMemo(() => {
    return modalidadesOpcoes.find((m) => m.id === selectedModalidadeId) || null;
  }, [modalidadesOpcoes, selectedModalidadeId]);

  const valorParcela = parcelaAceita;

  const percentualFranqueadoraEfetivo = useMemo(() => {
    return modalidadeAtiva?.percentualReferencia ?? 0;
  }, [modalidadeAtiva]);

  // 4. Perfis do Secundário
  const perfisSecundario = useMemo(() => {
    if (!selectedSecundarioId) return [];
    return vinculosPerfis.filter((v) => v.participante_id === selectedSecundarioId && v.perfil);
  }, [vinculosPerfis, selectedSecundarioId]);

  const perfilSecundarioAtivo = useMemo(() => {
    if (!selectedPerfilSecundarioId) return null;
    return perfisSecundario.find((p) => p.perfil_id === selectedPerfilSecundarioId) || null;
  }, [perfisSecundario, selectedPerfilSecundarioId]);

  const fracaoEfetivaSecundario = useMemo(() => {
    if (!selectedSecundarioId) return 0;
    if (modoSecundario === "PERFIL" && perfilSecundarioAtivo) {
      if (perfilSecundarioAtivo.override_percentual !== null) {
        return Number(perfilSecundarioAtivo.override_percentual);
      }
      const regra = regrasParticipantes.find((r) => r.perfil_id === perfilSecundarioAtivo.perfil_id);
      return regra ? Number(regra.percentual_comissao) : 20;
    }
    return Number(fracaoManualSecundario) || 0;
  }, [selectedSecundarioId, modoSecundario, perfilSecundarioAtivo, regrasParticipantes, fracaoManualSecundario]);

  // 5. Memória de Cálculo
  const calculo = useMemo(() => {
    const percentualFranqueadora = percentualFranqueadoraEfetivo;
    const valorFranqueadora = (valorCredito * percentualFranqueadora) / 100;
    const valorPrincipalBruto = (valorFranqueadora * percentualPrincipal) / 100;
    const valorSecundario = selectedSecundarioId
      ? (valorPrincipalBruto * fracaoEfetivaSecundario) / 100
      : 0;
    const valorPrincipalLiquido = valorPrincipalBruto - valorSecundario;

    const percentualPrincipalSobreCredito = (valorPrincipalLiquido / valorCredito) * 100;
    const percentualSecundarioSobreCredito = (valorSecundario / valorCredito) * 100;

    return {
      valorCredito,
      percentualFranqueadora,
      valorFranqueadora,
      percentualPrincipal,
      valorPrincipalBruto,
      fracaoEfetivaSecundario,
      valorSecundario,
      valorPrincipalLiquido,
      percentualPrincipalSobreCredito,
      percentualSecundarioSobreCredito,
    };
  }, [valorCredito, percentualFranqueadoraEfetivo, percentualPrincipal, selectedSecundarioId, fracaoEfetivaSecundario]);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await formalizarContratacaoAction(formData);
        });
      }}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <input type="hidden" name="contratacao_id" value={contratacaoId} />
      <input type="hidden" name="perfil_principal_id" value={perfilPrincipalAtivo?.perfil_id || ""} />
      <input type="hidden" name="perfil_secundario_id" value={perfilSecundarioAtivo?.perfil_id || ""} />
      <input type="hidden" name="modalidade_comissao_id" value={modalidadeAtiva?.id || ""} />
      <input type="hidden" name="tipo_venda" value={modalidadeAtiva?.codigo || "INTEGRAL"} />

      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          2. Dados comerciais e comissionamento da venda
        </h2>
        <p className="text-xs text-slate-500">
          Confira a condição aceita no site e defina somente comissão, consultores, divisão com SDR e datas de recebimento.
        </p>
      </div>

      {/* Grid de Seleção de Grupo, Cota e Consultores */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Grupo Canônico
          <select
            required
            name={condicaoComercialCongelada ? undefined : "grupo_id"}
            value={selectedGrupoId}
            disabled={condicaoComercialCongelada}
            onChange={(e) => {
              setSelectedGrupoId(e.target.value);
              setSelectedCotaId("");
              setSelectedModalidadeId("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o grupo</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {((g.administradora as any)?.nome || "Racon")} · Grupo {g.codigo_grupo} · {((g.tipo as any)?.nome || "Imóvel")}
              </option>
            ))}
          </select>
          {condicaoComercialCongelada ? <input type="hidden" name="grupo_id" value={selectedGrupoId} /> : null}
          {condicaoComercialCongelada ? <span className="mt-1 block text-[10px] normal-case text-emerald-700">Condição aceita no site — bloqueada para edição</span> : null}
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Quantidade de cotas
          <input
            required
            type="number"
            min={1}
            max={100}
            name={condicaoComercialCongelada ? undefined : "quantidade_cotas"}
            value={quantidadeCotas}
            disabled={condicaoComercialCongelada}
            onChange={(event) => setQuantidadeCotas(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {condicaoComercialCongelada ? <input type="hidden" name="quantidade_cotas" value={quantidadeCotas} /> : null}
          <span className="mt-1 block text-[10px] normal-case text-slate-500">
            A formalização gerará {quantidadeCotas} {quantidadeCotas === 1 ? "cota definitiva" : "cotas definitivas"} na mesma venda.
          </span>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Produto / Cota Comercial
          <select
            required
            name={condicaoComercialCongelada ? undefined : "opcao_cota_id"}
            value={selectedCotaId}
            disabled={condicaoComercialCongelada}
            onChange={(e) => {
              setSelectedCotaId(e.target.value);
              setSelectedModalidadeId("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o crédito</option>
            {cotasDisponiveis.map((o) => (
              <option key={o.id} value={o.id}>
                Crédito de {brl(Number(o.valor_credito))}
              </option>
            ))}
          </select>
          {condicaoComercialCongelada ? <input type="hidden" name="opcao_cota_id" value={selectedCotaId} /> : null}
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Consultor Principal *
          <select
            required
            name="participante_principal_id"
            value={selectedPrincipalId}
            onChange={(e) => {
              setSelectedPrincipalId(e.target.value);
              setSelectedPerfilPrincipalId("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o consultor</option>
            {participantes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_exibicao || p.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Participante Secundário (SDR / Parceiro)
          <select
            name="participante_secundario_id"
            value={selectedSecundarioId}
            onChange={(e) => {
              setSelectedSecundarioId(e.target.value);
              setSelectedPerfilSecundarioId("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Sem secundário (100% para o principal)</option>
            {participantes
              .filter((p) => p.id !== selectedPrincipalId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_exibicao || p.nome}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Modalidade comercial define somente a regra/cronograma de comissão. */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4.5 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
              Modelo comercial da comissão
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
              Comissão Franqueadora: <strong>{percentualFranqueadoraEfetivo.toFixed(2)}%</strong>
            </span>
          </div>
        </div>

        {/* 3 Opções Claras em Cards de Alta Visibilidade */}
        <div className="grid gap-3 sm:grid-cols-3">
          {modalidadesOpcoes.map((m) => {
            const isSelected = modalidadeAtiva?.id === m.id || modalidadeAtiva?.codigo === m.codigo;
            return (
              <label
                key={m.id || m.codigo}
                className={`flex flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition relative ${
                  isSelected
                    ? "border-indigo-600 bg-white shadow-md ring-2 ring-indigo-600/30 text-indigo-950 dark:bg-slate-800 dark:text-white"
                    : "border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="tipo_venda_radio_option"
                    required
                    checked={isSelected}
                    onChange={() => {
                      setSelectedModalidadeId(m.id);
                    }}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black">{m.nome}</p>
                      <span className={`rounded-full px-2 py-0.2 text-[10px] font-extrabold ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug dark:text-slate-400">
                      {m.descricao}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Comissão Franquia:</span>
                  <strong className="text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
                    {m.percentualReferencia.toFixed(2)}%
                  </strong>
                </div>
              </label>
            );
          })}
        </div>
        {selectedCotaId && modalidadesOpcoes.length === 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Não existe modelo de comissão homologado para esta administradora. Ajuste as regras antes de formalizar.
          </p>
        )}

      </div>

      {/* BLOCO: Datas das Parcelas de Comissão (Adesão vs 2ª Parcela em diante) */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-200">
            Cronograma & Datas de Recebimento das Comissões
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Data do Pagamento da 1ª Parcela (Adesão / 1ª Comissão):
            </label>
            <input
              type="date"
              name="data_primeira_parcela"
              value={dataPrimeiraParcela}
              onChange={(e) => setDataPrimeiraParcela(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Competência calculada: <strong>{dataPrimeiraParcela ? dataPrimeiraParcela.slice(0, 7) : "—"}</strong>
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Data de Vencimento da 2ª Parcela (Demais parcelas em diante):
            </label>
            <input
              type="date"
              name="data_segunda_parcela"
              value={dataSegundaParcela}
              onChange={(e) => setDataSegundaParcela(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              2ª parcela: <strong>{dataSegundaParcela ? dataSegundaParcela.slice(0, 7) : "—"}</strong> (e subsequentes mês a mês)
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-100/60 p-2.5 text-[11px] text-blue-900 dark:bg-blue-900/30 dark:text-blue-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Se o cliente pagou a adesão no ato (ex: 11/08), a 1ª parcela de comissão entra em Agosto/2026. Se a assembleia da administradora já passou, a 2ª parcela iniciará na data configurada acima (ex: 10/10/2026).
          </span>
        </div>
      </div>

      {/* BLOCO: Configuração de Modelo do Principal e Secundário */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bloco Modelo do Principal */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Modelo de Comissão do Principal
            </h3>
          </div>

          <div className="mt-3 space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Perfil / regra homologada do consultor:
            </label>
            <select
              required
              value={selectedPerfilPrincipalId}
              onChange={(e) => setSelectedPerfilPrincipalId(e.target.value)}
              className="w-full rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Selecione o perfil</option>
              {perfisPrincipal.map((p) => (
                <option key={p.perfil_id} value={p.perfil_id}>
                  {p.perfil?.nome} ({p.override_percentual !== null ? `${p.override_percentual}%` : "Percentual da regra"})
                </option>
              ))}
            </select>
            {selectedPrincipalId && perfisPrincipal.length === 0 && (
              <p className="text-xs font-semibold text-amber-700">Este participante não possui perfil de comissão ativo.</p>
            )}
          </div>
        </div>

        {/* Bloco Secundário (SDR / Parceiro) */}
        {selectedSecundarioId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200">
                  Divisão de Comissão (SDR / Parceiro)
                </h3>
              </div>
              <div className="flex rounded-lg bg-amber-200/60 p-0.5 text-[10px] font-bold text-amber-900">
                <button
                  type="button"
                  onClick={() => setModoSecundario("MANUAL")}
                  className={`rounded px-2 py-0.5 cursor-pointer ${modoSecundario === "MANUAL" ? "bg-white shadow-2xs font-black text-slate-900" : "text-amber-800"}`}
                >
                  % Manual
                </button>
                <button
                  type="button"
                  onClick={() => setModoSecundario("PERFIL")}
                  className={`rounded px-2 py-0.5 cursor-pointer ${modoSecundario === "PERFIL" ? "bg-white shadow-2xs font-black text-slate-900" : "text-amber-800"}`}
                >
                  Usar Perfil
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {modoSecundario === "MANUAL"
                    ? "% da comissão do consultor principal a repassar:"
                    : "Perfil de Comissão do Secundário:"}
                </label>
                {modoSecundario === "MANUAL" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={fracaoManualSecundario}
                      onChange={(e) => setFracaoManualSecundario(Number(e.target.value))}
                      className="w-24 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">%</span>
                    <span className="text-[11px] text-slate-500">
                      (Equivale a {fracaoEfetivaSecundario}% sobre os ganhos do Consultor Principal)
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedPerfilSecundarioId || perfisSecundario[0]?.perfil_id || ""}
                    onChange={(e) => setSelectedPerfilSecundarioId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {perfisSecundario.map((p) => (
                      <option key={p.perfil_id} value={p.perfil_id}>
                        {p.perfil?.nome} ({p.override_percentual !== null ? `${p.override_percentual}%` : "Padrão"})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="hidden"
                  name="fracao_secundario"
                  value={fracaoEfetivaSecundario}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Forma de Recebimento:
                </label>
                <select
                  name="cronograma_secundario"
                  value={cronogramaSecundario}
                  onChange={(e) => setCronogramaSecundario(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="SEGUIR_PRINCIPAL">Seguir cronograma do Principal (Mês a mês)</option>
                  <option value="AVISTA_1X">1x Parcela Única (na 1ª parcela)</option>
                  <option value="PARCELADO_2X">2x Parcelas fixas</option>
                  <option value="PARCELADO_3X">3x Parcelas fixas</option>
                  <option value="PARCELADO_4X">4x Parcelas fixas (Padrão SDR)</option>
                  <option value="PARCELADO_6X">6x Parcelas fixas</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
            <Users className="mb-1 h-5 w-5 text-slate-300" />
            <p className="font-medium">Nenhum secundário selecionado.</p>
            <p className="text-[11px] text-slate-400">100% da comissão da venda será creditada ao Consultor Principal.</p>
          </div>
        )}
      </div>

      {/* BLOCO: Memória de Cálculo em Tempo Real (Live Split) */}
      <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/50 to-indigo-50/30 p-4 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-blue-700 dark:text-blue-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-200">
            Memória de Cálculo da Comissão
          </h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500">Crédito contratado ({quantidadeCotas} {quantidadeCotas === 1 ? "cota" : "cotas"})</p>
            <p className="text-base font-black text-slate-900 dark:text-white">{brl(calculo.valorCredito)}</p>
            <p className="text-[10px] font-semibold text-emerald-700">Parcela aceita: {valorParcela > 0 ? brl(valorParcela) : "—"}</p>
            <p className="text-[10px] text-slate-400">
              {prazoRestante} parcelas restantes de {prazoTotal} originais
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500">
              Franqueadora ({calculo.percentualFranqueadora.toFixed(2)}%)
            </p>
            <p className="text-base font-black text-blue-700 dark:text-blue-400">{brl(calculo.valorFranqueadora)}</p>
            <p className="text-[10px] text-slate-400">Tipo: {modalidadeAtiva?.nome || "Integral"}</p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500">
              Consultor Principal {selectedSecundarioId ? "(Líquido)" : ""}
            </p>
            <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
              {brl(calculo.valorPrincipalLiquido)}
            </p>
            <p className="text-[10px] text-emerald-600">
              {calculo.percentualPrincipalSobreCredito.toFixed(2)}% do crédito
              {selectedSecundarioId && ` (${(100 - calculo.fracaoEfetivaSecundario).toFixed(0)}% da sua parte)`}
            </p>
          </div>

          {selectedSecundarioId ? (
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
              <p className="text-[11px] font-semibold text-slate-500">Secundário / SDR</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">{brl(calculo.valorSecundario)}</p>
              <p className="text-[10px] text-amber-600">
                {calculo.percentualSecundarioSobreCredito.toFixed(2)}% do crédito ({calculo.fracaoEfetivaSecundario}% do Principal)
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 flex items-center justify-center">
              <p className="text-xs font-semibold text-slate-400">Sem divisão</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          3. Resumo da Venda
        </h3>
        <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
          Cliente: <strong>{clienteNome}</strong> · Grupo: <strong>{grupoAtual ? `Grupo ${grupoAtual.codigo_grupo}` : "não selecionado"}</strong> · Quantidade: <strong>{quantidadeCotas} {quantidadeCotas === 1 ? "cota" : "cotas"}</strong> · Modelo de comissão: <strong>{modalidadeAtiva?.nome || "não selecionado"}</strong> · Crédito aceito: <strong>{brl(valorCredito)}</strong> · Parcela aceita no site: <strong>{valorParcela ? brl(valorParcela) : "não informada"}</strong> · Prazo: <strong>{prazoRestante}/{prazoTotal}</strong> · Forma de pagamento: <strong>{formaPagamento || "Boleto"}</strong>
        </p>
      </div>

      {!formalizada && (
        <button
          type="submit"
          disabled={
            isPending ||
            !selectedGrupoId ||
            !selectedCotaId ||
             !selectedModalidadeId ||
             !selectedPrincipalId ||
             !selectedPerfilPrincipalId ||
             percentualFranqueadoraEfetivo <= 0
          }
          className="w-full sm:w-auto rounded-xl bg-blue-700 px-7 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-blue-800 disabled:opacity-50 transition cursor-pointer"
        >
          {isPending ? `Formalizando venda e gerando ${quantidadeCotas} ${quantidadeCotas === 1 ? "cota" : "cotas"}...` : "Confirmar e formalizar venda"}
        </button>
      )}
    </form>
  );
}
