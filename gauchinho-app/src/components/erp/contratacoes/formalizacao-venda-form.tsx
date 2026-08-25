"use client";

import { useState, useMemo, useTransition } from "react";
import { formalizarContratacaoAction } from "@/app/erp/contratacoes/actions";
import { Users, Calculator, UserCheck, Split } from "lucide-react";

export type GrupoCota = {
  id: string;
  valor_credito: number;
  valor_parcela: number;
  prazo?: number;
  ativo?: boolean;
  status?: string;
  grupo_codigo?: string;
};

export type GrupoConsorcio = {
  id: string;
  codigo_grupo: string;
  administradora_id: string;
  status_governanca: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  prazo_total: number | null;
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
  percentual_comissao: number;
  seguir_cronograma_franquia: boolean;
  etapas_cronograma: unknown;
  base_v2: string;
  status: string;
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
  initialGrupoId: string;
  initialCotaId: string;
  initialPrincipalId: string;
  initialSecundarioId: string | null;
  initialFracaoSecundario: number | null;
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
  initialGrupoId,
  initialCotaId,
  initialPrincipalId,
  initialSecundarioId,
  initialFracaoSecundario,
}: FormalizacaoVendaFormProps) {
  const [isPending, startTransition] = useTransition();

  const [selectedGrupoId, setSelectedGrupoId] = useState(initialGrupoId || grupos[0]?.id || "");
  const [selectedCotaId, setSelectedCotaId] = useState(initialCotaId || "");
  const [selectedPrincipalId, setSelectedPrincipalId] = useState(initialPrincipalId || participantes[0]?.id || "");
  const [selectedPerfilPrincipalId, setSelectedPerfilPrincipalId] = useState("");

  const [selectedSecundarioId, setSelectedSecundarioId] = useState(initialSecundarioId || "");
  const [modoSecundario, setModoSecundario] = useState<"PERFIL" | "MANUAL">("MANUAL");
  const [selectedPerfilSecundarioId, setSelectedPerfilSecundarioId] = useState("");
  const [fracaoManualSecundario, setFracaoManualSecundario] = useState<number>(
    initialFracaoSecundario ? Number(initialFracaoSecundario) : 20
  );
  const [cronogramaSecundario, setCronogramaSecundario] = useState("SEGUIR_PRINCIPAL");

  // 1. Grupo e Cotas disponíveis
  const grupoAtual = useMemo(() => grupos.find((g) => g.id === selectedGrupoId) || grupos[0], [grupos, selectedGrupoId]);
  const cotasDisponiveis = useMemo(() => (grupoAtual?.grupos_cotas ?? []).filter((c) => c.ativo !== false), [grupoAtual]);
  const cotaAtual = useMemo(
    () => cotasDisponiveis.find((c) => c.id === selectedCotaId) || cotasDisponiveis[0] || null,
    [cotasDisponiveis, selectedCotaId]
  );

  const valorCredito = cotaAtual?.valor_credito || 500000;
  const valorParcela = cotaAtual?.valor_parcela || 0;
  const prazoTotal = grupoAtual?.prazo_total || 180;

  // 2. Perfis do Consultor Principal
  const perfisPrincipal = useMemo(() => {
    if (!selectedPrincipalId) return [];
    return vinculosPerfis.filter((v) => v.participante_id === selectedPrincipalId && v.perfil);
  }, [vinculosPerfis, selectedPrincipalId]);

  const perfilPrincipalAtivo = useMemo(() => {
    if (selectedPerfilPrincipalId) {
      return perfisPrincipal.find((p) => p.perfil_id === selectedPerfilPrincipalId) || perfisPrincipal[0];
    }
    return perfisPrincipal[0] || null;
  }, [perfisPrincipal, selectedPerfilPrincipalId]);

  const percentualPrincipal = useMemo(() => {
    if (!perfilPrincipalAtivo) return 50;
    if (perfilPrincipalAtivo.override_percentual !== null && perfilPrincipalAtivo.override_percentual !== undefined) {
      return Number(perfilPrincipalAtivo.override_percentual);
    }
    const regra = regrasParticipantes.find((r) => r.perfil_id === perfilPrincipalAtivo.perfil_id);
    if (regra?.percentual_comissao) return Number(regra.percentual_comissao);
    if (perfilPrincipalAtivo.perfil?.nome.toLowerCase().includes("sócio") || perfilPrincipalAtivo.papel_tipo === "GESTOR") {
      return 100;
    }
    return 50;
  }, [perfilPrincipalAtivo, regrasParticipantes]);

  // 3. Perfis do Secundário
  const perfisSecundario = useMemo(() => {
    if (!selectedSecundarioId) return [];
    return vinculosPerfis.filter((v) => v.participante_id === selectedSecundarioId && v.perfil);
  }, [vinculosPerfis, selectedSecundarioId]);

  const perfilSecundarioAtivo = useMemo(() => {
    if (selectedPerfilSecundarioId) {
      return perfisSecundario.find((p) => p.perfil_id === selectedPerfilSecundarioId) || perfisSecundario[0];
    }
    return perfisSecundario[0] || null;
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

  // 4. Memória de Cálculo
  const calculo = useMemo(() => {
    const percentualFranqueadora = 4.0;
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
  }, [valorCredito, percentualPrincipal, selectedSecundarioId, fracaoEfetivaSecundario]);

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

      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          2. Dados comerciais e comissionamento da venda
        </h2>
        <p className="text-xs text-slate-500">
          Defina o consultor principal, divisão de comissão com SDR / parceiro e regra de recebimento.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Grupo Canônico
          <select
            required
            name="grupo_id"
            value={selectedGrupoId}
            onChange={(e) => setSelectedGrupoId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Selecione o grupo</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {((g.administradora as any)?.nome || "Racon")} · Grupo {g.codigo_grupo} · {((g.tipo as any)?.nome || "Imóvel")}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Produto / Cota Comercial
          <select
            required
            name="opcao_cota_id"
            value={selectedCotaId || (cotasDisponiveis[0]?.id ?? "")}
            onChange={(e) => setSelectedCotaId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {cotasDisponiveis.map((o) => (
              <option key={o.id} value={o.id}>
                {brl(Number(o.valor_credito))} · {prazoTotal}x de {brl(Number(o.valor_parcela))}
              </option>
            ))}
          </select>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Modelo de Comissão do Principal
            </h3>
          </div>

          {perfisPrincipal.length <= 1 ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/30">
              <p className="font-bold text-blue-900 dark:text-blue-300">
                {perfisPrincipal[0]?.perfil?.nome || "Consultor Padrão (50% da Franqueadora)"}
              </p>
              <p className="mt-0.5 text-blue-700/80 dark:text-blue-400/80">
                {percentualPrincipal}% da comissão líquida da franqueadora ({((4.0 * percentualPrincipal) / 100).toFixed(2)}% do crédito).
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Selecione o papel do consultor nesta venda:
              </label>
              <select
                value={selectedPerfilPrincipalId || perfisPrincipal[0]?.perfil_id}
                onChange={(e) => setSelectedPerfilPrincipalId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {perfisPrincipal.map((p) => (
                  <option key={p.id} value={p.perfil_id}>
                    {p.perfil?.nome} ({p.papel_tipo})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedSecundarioId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Split className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Divisão & Recebimento do Secundário
                </h3>
              </div>
              <div className="flex rounded-lg bg-white p-0.5 shadow-2xs border border-amber-200 text-[10px] font-bold dark:bg-slate-800 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModoSecundario("MANUAL")}
                  className={`rounded px-2 py-0.5 transition ${modoSecundario === "MANUAL" ? "bg-amber-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300"}`}
                >
                  % Manual
                </button>
                {perfisSecundario.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setModoSecundario("PERFIL")}
                    className={`rounded px-2 py-0.5 transition ${modoSecundario === "PERFIL" ? "bg-amber-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300"}`}
                  >
                    Usar Perfil
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Fração sobre o Principal (%):
                </label>
                {modoSecundario === "MANUAL" ? (
                  <input
                    name="fracao_secundario"
                    type="number"
                    min="0.1"
                    max="99.9"
                    step="0.1"
                    value={fracaoManualSecundario}
                    onChange={(e) => setFracaoManualSecundario(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                ) : (
                  <select
                    value={selectedPerfilSecundarioId || perfisSecundario[0]?.perfil_id}
                    onChange={(e) => setSelectedPerfilSecundarioId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {perfisSecundario.map((p) => (
                      <option key={p.id} value={p.perfil_id}>
                        {p.perfil?.nome} ({p.papel_tipo})
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

      <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/50 to-indigo-50/30 p-4 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-blue-700 dark:text-blue-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-200">
            Memória de Cálculo da Comissão
          </h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500">Crédito da Cota</p>
            <p className="text-base font-black text-slate-900 dark:text-white">{brl(calculo.valorCredito)}</p>
            <p className="text-[10px] text-slate-400">Prazo: {prazoTotal} meses</p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500">Franqueadora (4%)</p>
            <p className="text-base font-black text-blue-700 dark:text-blue-400">{brl(calculo.valorFranqueadora)}</p>
            <p className="text-[10px] text-slate-400">Recebimento da Racon</p>
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
          Cliente: <strong>{clienteNome}</strong> · Grupo: <strong>Grupo {grupoAtual?.codigo_grupo || "1463"}</strong> · Crédito: <strong>{brl(valorCredito)}</strong> · Forma de pagamento: <strong>{formaPagamento || "Boleto"}</strong>
        </p>
      </div>

      {!formalizada && (
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto rounded-xl bg-blue-700 px-7 py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-blue-800 disabled:opacity-50 transition cursor-pointer"
        >
          {isPending ? "Formalizando venda e gerando cota..." : "Confirmar e formalizar venda"}
        </button>
      )}
    </form>
  );
}