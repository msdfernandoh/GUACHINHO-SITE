"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createCommissionProgramAction,
  createFranchiseRuleAction,
  createParticipantRuleAction,
  type CommissionActionState,
} from "@/app/erp/regras-comissao/actions";

type Program = { id: string; nome: string; administradora_id: string | null };
type Administrator = { id: string; nome: string };
type Quota = { id: string; label: string; administradoraId: string };
type CatalogItem = { id: string; nome: string; administradoraId: string };
type Participant = { id: string; nome: string };
type Stage = {
  nome: string;
  tipo_gatilho: "MES_RELATIVO" | "CONTEMPLACAO";
  mes_relativo: string;
  valor: string;
};

const initialState: CommissionActionState = { ok: false, message: "" };
const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const labelClass = "text-sm font-medium text-slate-700";

function Feedback({ state }: { state: CommissionActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
    >
      {state.message}
    </p>
  );
}

export function CommissionRuleManager({
  empresaId,
  programas,
  administradoras,
  cotas,
  tipos,
  modalidades,
  participantes,
  officialSetup = true,
  participantSetup = true,
}: {
  empresaId: string;
  programas: Program[];
  administradoras: Administrator[];
  cotas: Quota[];
  tipos: CatalogItem[];
  modalidades: CatalogItem[];
  participantes: Participant[];
  officialSetup?: boolean;
  participantSetup?: boolean;
}) {
  const [programState, programAction, programPending] = useActionState(
    createCommissionProgramAction,
    initialState,
  );
  const [ruleState, ruleAction, rulePending] = useActionState(
    createFranchiseRuleAction,
    initialState,
  );
  const [participantState, participantAction, participantPending] =
    useActionState(createParticipantRuleAction, initialState);
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  const [base, setBase] = useState<"credito" | "valor_fixo">("credito");
  const [stages, setStages] = useState<Stage[]>([
    {
      nome: "1ª parcela",
      tipo_gatilho: "MES_RELATIVO",
      mes_relativo: "1",
      valor: "",
    },
  ]);
  const [participantStages, setParticipantStages] = useState([
    { nome: "Parcela única", mes: "1", percentual: "100" },
  ]);
  const [participantMode, setParticipantMode] = useState<
    "AUTOMATICA" | "MANUAL"
  >("AUTOMATICA");
  const selectedAdmin = programas.find(
    (programa) => programa.id === programaId,
  )?.administradora_id;
  const quotas = useMemo(
    () =>
      cotas.filter(
        (cota) => !selectedAdmin || cota.administradoraId === selectedAdmin,
      ),
    [cotas, selectedAdmin],
  );
  const serializedStages = JSON.stringify(
    stages.map((stage, index) => ({
      ordem: index + 1,
      nome: stage.nome,
      tipo_gatilho: stage.tipo_gatilho,
      mes_relativo:
        stage.tipo_gatilho === "CONTEMPLACAO" ? null : stage.mes_relativo,
      [base === "credito" ? "percentual_venda" : "valor_etapa"]: stage.valor,
    })),
  );

  function setStage(index: number, field: keyof Stage, value: string) {
    setStages((current) =>
      current.map((stage, position) =>
        position === index ? { ...stage, [field]: value } : stage,
      ),
    );
  }

  function changeBase(next: "credito" | "valor_fixo") {
    setBase(next);
    setStages([
      {
        nome: "1ª parcela",
        tipo_gatilho: "MES_RELATIVO",
        mes_relativo: "1",
        valor: "",
      },
    ]);
  }

  return (
    <section className="space-y-5 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Cadastro seguro
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          Programas e múltiplas regras
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cada regra recebe uma nova versão. O percentual ou valor deve ser
          informado; nada é ativado no motor enquanto não houver homologação
          explícita.
        </p>
      </div>
      {officialSetup ? (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.7fr]">
          <form
            action={programAction}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="font-semibold text-slate-900">1. Criar programa</h3>
            <input type="hidden" name="empresa_id" value={empresaId} />
            <label className={labelClass}>
              Nome
              <input
                className={inputClass}
                name="nome"
                required
                placeholder="Ex.: Racon Imóveis 2026"
              />
            </label>
            <label className={labelClass}>
              Administradora
              <select
                className={inputClass}
                name="administradora_id"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {administradoras.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Descrição
              <textarea
                className={inputClass}
                name="descricao"
                rows={2}
                placeholder="Finalidade e condições do programa"
              />
            </label>
            <Feedback state={programState} />
            <button
              disabled={programPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {programPending ? "Salvando..." : "Criar programa"}
            </button>
          </form>

          <form
            action={ruleAction}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div>
              <h3 className="font-semibold text-slate-900">
                2. Adicionar regra da franquia
              </h3>
              <p className="text-xs text-slate-500">
                A versão é atribuída automaticamente e nasce não homologada.
              </p>
            </div>
            <input type="hidden" name="empresa_id" value={empresaId} />
            <input
              type="hidden"
              name="etapas_cronograma"
              value={serializedStages}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Programa
                <select
                  className={inputClass}
                  name="programa_id"
                  required
                  value={programaId}
                  onChange={(event) => setProgramaId(event.target.value)}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {programas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Base de cálculo
                <select
                  className={inputClass}
                  name="base_calculo"
                  value={base}
                  onChange={(event) =>
                    changeBase(event.target.value as "credito" | "valor_fixo")
                  }
                >
                  <option value="credito">
                    Percentual direto sobre o valor vendido
                  </option>
                </select>
              </label>
              <label className={labelClass}>
                {base === "credito"
                  ? "Percentual total da comissão"
                  : "Valor fixo total"}
                <input
                  className={inputClass}
                  name="valor_comissao"
                  inputMode="decimal"
                  required
                  placeholder={
                    base === "credito" ? "Ex.: 2,75" : "Ex.: 1500,00"
                  }
                />
              </label>
              <label className={labelClass}>
                Tipo da Administradora
                <select
                  className={inputClass}
                  name="tipo_administradora_id"
                  defaultValue=""
                >
                  <option value="">Todos os tipos</option>
                  {tipos
                    .filter(
                      (item) =>
                        !selectedAdmin ||
                        item.administradoraId === selectedAdmin,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label className={labelClass}>
                Modalidade / tabela
                <select
                  className={inputClass}
                  name="modalidade_comissao_id"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {modalidades
                    .filter(
                      (item) =>
                        !selectedAdmin ||
                        item.administradoraId === selectedAdmin,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label className={labelClass}>
                Início da vigência
                <input
                  className={inputClass}
                  type="date"
                  name="vigencia_inicio"
                  required
                />
              </label>
              <label className={labelClass}>
                Fim da vigência (opcional)
                <input className={inputClass} type="date" name="vigencia_fim" />
              </label>
              <label className={labelClass}>
                Opção de cota (opcional)
                <select
                  className={inputClass}
                  name="opcao_cota_id"
                  defaultValue=""
                >
                  <option value="">Todas as cotas</option>
                  {quotas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Plano/condição (opcional)
                <input
                  className={inputClass}
                  name="plano_condicao"
                  placeholder="Ex.: parcela reduzida"
                />
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Cronograma
                  </p>
                  <p className="text-xs text-slate-500">
                    {base === "credito"
                      ? "Informe diretamente o percentual sobre o valor vendido; a soma fecha no total da regra."
                      : "A soma das etapas deve fechar no valor fixo total."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setStages((current) => [
                      ...current,
                      {
                        nome: `Parcela ${current.length + 1}`,
                        tipo_gatilho: "MES_RELATIVO",
                        mes_relativo: String(current.length + 1),
                        valor: "",
                      },
                    ])
                  }
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700"
                >
                  Adicionar etapa
                </button>
              </div>
              {stages.map((stage, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1.3fr_1fr_0.7fr_0.8fr_auto]"
                >
                  <label className={labelClass}>
                    Nome
                    <input
                      className={inputClass}
                      value={stage.nome}
                      onChange={(event) =>
                        setStage(index, "nome", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Gatilho
                    <select
                      className={inputClass}
                      value={stage.tipo_gatilho}
                      onChange={(event) => {
                        const trigger = event.target
                          .value as Stage["tipo_gatilho"];
                        setStages((current) =>
                          current.map((item, position) =>
                            position === index
                              ? {
                                  ...item,
                                  tipo_gatilho: trigger,
                                  mes_relativo:
                                    trigger === "CONTEMPLACAO"
                                      ? ""
                                      : item.mes_relativo,
                                  nome:
                                    trigger === "CONTEMPLACAO"
                                      ? "CONTEMPLAÇÃO"
                                      : item.nome,
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      <option value="MES_RELATIVO">Mês relativo</option>
                      <option value="CONTEMPLACAO">Contemplação</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Mês relativo
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={stage.mes_relativo}
                      onChange={(event) =>
                        setStage(index, "mes_relativo", event.target.value)
                      }
                      required={stage.tipo_gatilho === "MES_RELATIVO"}
                      disabled={stage.tipo_gatilho === "CONTEMPLACAO"}
                    />
                  </label>
                  <label className={labelClass}>
                    {base === "credito" ? "% sobre a venda" : "Valor da etapa"}
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={stage.valor}
                      onChange={(event) =>
                        setStage(index, "valor", event.target.value)
                      }
                      required
                    />
                  </label>
                  <button
                    type="button"
                    disabled={stages.length === 1}
                    onClick={() =>
                      setStages((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                    className="self-end rounded-lg px-2 py-2 text-xs font-semibold text-red-600 disabled:opacity-30"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <Feedback state={ruleState} />
            <button
              disabled={rulePending || programas.length === 0}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {rulePending ? "Salvando..." : "Criar nova regra não homologada"}
            </button>
          </form>
        </div>
      ) : null}
      {participantSetup ? (
        <form
          action={participantAction}
          className="space-y-4 rounded-xl border border-violet-200 bg-white p-4 shadow-sm"
        >
          <div>
            <h3 className="font-semibold text-slate-900">
              3. Regra do participante
            </h3>
            <p className="text-xs text-slate-500">
              Automática acompanha a comissão líquida da Franqueadora. Manual
              permite base e cronograma próprios.
            </p>
          </div>
          <input type="hidden" name="empresa_id" value={empresaId} />
          <input
            type="hidden"
            name="etapas_cronograma"
            value={
              participantMode === "AUTOMATICA"
                ? "[]"
                : JSON.stringify(
                    participantStages.map((stage, index) => ({
                      ordem: index + 1,
                      nome: stage.nome,
                      mes_relativo: Number(stage.mes),
                      percentual_etapa: Number(
                        stage.percentual.replace(",", "."),
                      ),
                    })),
                  )
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClass}>
              Programa
              <select
                className={inputClass}
                name="programa_id"
                required
                value={programaId}
                onChange={(event) => setProgramaId(event.target.value)}
              >
                {programas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Participante
              <select
                className={inputClass}
                name="participante_comercial_id"
                defaultValue=""
              >
                <option value="">Regra geral por tipo</option>
                {participantes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Tipo operacional
              <select
                className={inputClass}
                name="tipo_participante"
                defaultValue=""
              >
                <option value="">Qualquer tipo</option>
                <option>CONSULTOR</option>
                <option>PARCEIRO</option>
                <option>MICROFRANQUIA</option>
                <option>SDR</option>
              </select>
            </label>
            <label className={labelClass}>
              Modo
              <select
                className={inputClass}
                name="modo_regra"
                value={participantMode}
                onChange={(event) =>
                  setParticipantMode(
                    event.target.value as "AUTOMATICA" | "MANUAL",
                  )
                }
              >
                <option value="AUTOMATICA">
                  Automática — % da comissão líquida
                </option>
                <option value="MANUAL">Manual — cronograma próprio</option>
              </select>
            </label>
            {participantMode === "MANUAL" ? (
              <label className={labelClass}>
                Base
                <select className={inputClass} name="base_v2">
                  <option value="COMISSAO_FRANQUEADORA_LIQUIDA">
                    % da comissão líquida da Franqueadora
                  </option>
                  <option value="VALOR_VENDIDO">% do valor vendido</option>
                </select>
              </label>
            ) : (
              <input
                type="hidden"
                name="base_v2"
                value="COMISSAO_FRANQUEADORA_LIQUIDA"
              />
            )}
            {participantMode === "MANUAL" ? (
              <label className={labelClass}>
                Fonte
                <select className={inputClass} name="fonte_comissao">
                  <option value="FRANQUEADORA">Franqueadora</option>
                  <option value="PARTICIPANTE_PRINCIPAL">
                    Participante principal
                  </option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="fonte_comissao" value="FRANQUEADORA" />
            )}
            <label className={labelClass}>
              Percentual
              <input
                className={inputClass}
                name="percentual_comissao"
                inputMode="decimal"
                required
                placeholder="Ex.: 50,00"
              />
            </label>
            <label className={labelClass}>
              Início da vigência
              <input
                className={inputClass}
                type="date"
                name="vigencia_inicio"
                required
              />
            </label>
            <label className={labelClass}>
              Fim da vigência
              <input className={inputClass} type="date" name="vigencia_fim" />
            </label>
            <label className={labelClass}>
              Tipo (opcional / todos)
              <select className={inputClass} name="tipo_administradora_id">
                <option value="">Todos os tipos</option>
                {tipos
                  .filter(
                    (item) =>
                      !selectedAdmin || item.administradoraId === selectedAdmin,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Modalidade (opcional)
              <select className={inputClass} name="modalidade_comissao_id">
                <option value="">Todas</option>
                {modalidades
                  .filter(
                    (item) =>
                      !selectedAdmin || item.administradoraId === selectedAdmin,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {participantMode === "MANUAL" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Cronograma próprio (soma 100%)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setParticipantStages((current) => [
                      ...current,
                      {
                        nome: `Parcela ${current.length + 1}`,
                        mes: String(current.length + 1),
                        percentual: "",
                      },
                    ])
                  }
                  className="rounded border px-3 py-1 text-xs font-bold"
                >
                  Adicionar etapa
                </button>
              </div>
              {participantStages.map((stage, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[1.5fr_0.6fr_0.8fr_auto]"
                >
                  <input
                    aria-label="Nome da etapa"
                    className={inputClass}
                    value={stage.nome}
                    onChange={(event) =>
                      setParticipantStages((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, nome: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Mês relativo"
                    className={inputClass}
                    type="number"
                    min="1"
                    value={stage.mes}
                    onChange={(event) =>
                      setParticipantStages((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, mes: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Percentual da etapa"
                    className={inputClass}
                    inputMode="decimal"
                    value={stage.percentual}
                    onChange={(event) =>
                      setParticipantStages((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, percentual: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={participantStages.length === 1}
                    onClick={() =>
                      setParticipantStages((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                    className="text-xs font-bold text-red-600 disabled:opacity-30"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              Esta regra acompanha automaticamente o cronograma da comissão da
              Franqueadora.
            </div>
          )}
          <p className="text-xs text-slate-500">
            Na base “valor vendido”, a equivalência sobre a comissão da
            Franqueadora é calculada a partir do snapshot no motor e exibida na
            previsão; ela não altera a regra financeira.
          </p>
          <Feedback state={participantState} />
          <button
            disabled={participantPending}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {participantPending
              ? "Salvando..."
              : "Criar regra de participante não homologada"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
