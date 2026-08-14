import { getCurrentTenantContext } from "@/lib/tenant/context";
import {
  listPrevisoesFranquiaForEmpresa,
  listPrevisoesParticipantesForEmpresa,
} from "@/lib/comissoes/comissoes-service";
import {
  confirmarPagamentosEmLoteAction,
  confirmarPagamentoComissaoAction,
  confirmarRecebimentosEmLoteAction,
  confirmarRecebimentoComissaoAction,
  transferirPendenciaComissaoAction,
} from "./actions";
import { CommissionBulkSelector } from "@/components/erp/commission-bulk-selector";

export default async function AdminComissoesPage() {
  const { empresaAtiva } = await getCurrentTenantContext();

  const empresaId = empresaAtiva?.id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  const empresaNome =
    empresaAtiva?.nome_fantasia ??
    empresaAtiva?.razao_social ??
    "Gauchinho Consórcios";

  const prevFranquia = await listPrevisoesFranquiaForEmpresa(empresaId);
  const prevParticipantes =
    await listPrevisoesParticipantesForEmpresa(empresaId);

  const totalFranquiaPrevisto = prevFranquia.reduce(
    (acc, curr) => acc + Number(curr.valor_previsto ?? 0),
    0,
  );
  const totalPartPrevisto = prevParticipantes.reduce(
    (acc, curr) => acc + Number(curr.valor_previsto ?? 0),
    0,
  );
  const totalRecebido = prevFranquia.reduce(
    (acc, curr) => acc + Number(curr.valor_liquidado ?? 0),
    0,
  );
  const totalPendente = totalFranquiaPrevisto - totalRecebido;
  const totalImposto = prevFranquia.reduce(
    (acc, curr) => acc + Number(curr.valor_imposto ?? 0),
    0,
  );
  const resultadoFranqueadora =
    prevFranquia.reduce(
      (acc, curr) =>
        acc + Number(curr.valor_liquido ?? curr.valor_previsto ?? 0),
      0,
    ) - totalPartPrevisto;

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Motor de Comissões &amp; Previsões de Competência
          </h1>
          <p className="text-sm text-slate-500">
            Empresa: <strong className="text-slate-700">{empresaNome}</strong>
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-emerald-700">
            Previsão Receita Franquia (Bruto)
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">
            {totalFranquiaPrevisto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-xs text-emerald-600 mt-1">
            {prevFranquia.length} parcelas/etapas previstas
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-blue-700">
            Previsão Comissão Participantes
          </div>
          <div className="text-2xl font-extrabold text-blue-900 mt-1">
            {totalPartPrevisto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {prevParticipantes.length} repasses de participantes previstos
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-amber-700">
            Recebido / pendente
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-900">
            {totalRecebido.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-xs text-amber-700">
            Pendente{" "}
            {totalPendente.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-5">
          <div className="text-xs uppercase font-semibold text-violet-700">
            Resultado da Franqueadora
          </div>
          <div className="mt-1 text-xl font-extrabold text-violet-900">
            {resultadoFranqueadora.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-xs text-violet-700">
            Imposto provisionado{" "}
            {totalImposto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>
      </div>

      {/* Seção Previsões Franquia */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Cronograma de Receita da Franquia ({prevFranquia.length})
        </h2>
        <CommissionBulkSelector
          items={prevFranquia
            .filter((f) => Number(f.valor_previsto) > Number(f.valor_liquidado))
            .map((f) => ({
              id: f.id,
              label: `${f.competencia} · ${f.tipo_gatilho === "CONTEMPLACAO" ? "CONTEMPLAÇÃO" : f.nome_etapa}`,
            }))}
          action={confirmarRecebimentosEmLoteAction}
          label="Confirmar recebimentos"
        />
        {prevFranquia.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma previsão de comissão da franquia gerada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Competência</th>
                  <th className="p-3">Etapa</th>
                  <th className="p-3">Base Cálculo</th>
                  <th className="p-3">% Aplicado</th>
                  <th className="p-3">Valor Previsto</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Confirmar recebimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prevFranquia.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">
                      {f.competencia}
                    </td>
                    <td className="p-3 text-slate-700">
                      {f.tipo_gatilho === "CONTEMPLACAO"
                        ? "CONTEMPLAÇÃO"
                        : f.nome_etapa}
                    </td>
                    <td className="p-3 text-slate-700">
                      {Number(f.base_calculo_valor).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3 text-slate-700">
                      {f.percentual_aplicado}%
                    </td>
                    <td className="p-3 font-medium text-emerald-700">
                      {Number(f.valor_previsto).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          f.status === "prevista"
                            ? "bg-emerald-100 text-emerald-800"
                            : f.status === "suspensa"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <form
                        action={confirmarRecebimentoComissaoAction}
                        className="flex min-w-56 gap-2"
                      >
                        <input type="hidden" name="previsao_id" value={f.id} />
                        <input
                          name="valor"
                          defaultValue={Math.max(
                            0,
                            Number(f.valor_previsto) -
                              Number(f.valor_liquidado),
                          ).toFixed(2)}
                          className="w-24 rounded border px-2 py-1"
                        />
                        <input
                          name="motivo"
                          placeholder="Motivo se maior"
                          className="w-28 rounded border px-2 py-1"
                        />
                        <input
                          type="hidden"
                          name="observacao"
                          value="Confirmação operacional ERP"
                        />
                        <button className="rounded bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                          Confirmar
                        </button>
                      </form>
                      {Number(f.valor_previsto) - Number(f.valor_liquidado) >
                        0 && (
                        <form
                          action={transferirPendenciaComissaoAction}
                          className="mt-2 flex min-w-56 gap-2"
                        >
                          <input
                            type="hidden"
                            name="previsao_id"
                            value={f.id}
                          />
                          <input
                            type="month"
                            name="competencia_destino"
                            required
                            className="w-32 rounded border px-2 py-1"
                          />
                          <input
                            name="motivo_transferencia"
                            required
                            placeholder="Motivo"
                            className="w-28 rounded border px-2 py-1"
                          />
                          <button className="rounded border border-amber-600 px-2 py-1 text-xs font-bold text-amber-800">
                            Transferir saldo
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seção Previsões Participantes */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Cronograma de Comissão dos Participantes ({prevParticipantes.length})
        </h2>
        <CommissionBulkSelector
          items={prevParticipantes
            .filter((p) => Number(p.valor_elegivel) > Number(p.valor_pago))
            .map((p) => ({
              id: p.id,
              label: `${p.competencia} · ${p.nome_etapa}`,
            }))}
          action={confirmarPagamentosEmLoteAction}
          label="Confirmar pagamentos"
        />
        {prevParticipantes.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-md border border-dashed">
            Nenhuma previsão de participante registrada para {empresaNome}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Competência</th>
                  <th className="p-3">Etapa</th>
                  <th className="p-3">Base Cálculo</th>
                  <th className="p-3">% Aplicado</th>
                  <th className="p-3">Valor Previsto</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Confirmar pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prevParticipantes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">
                      {p.competencia}
                    </td>
                    <td className="p-3 text-slate-700">{p.nome_etapa}</td>
                    <td className="p-3 text-slate-700">
                      {Number(p.base_calculo_valor).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3 text-slate-700">
                      {p.percentual_aplicado}%
                    </td>
                    <td className="p-3 font-medium text-blue-700">
                      {Number(p.valor_previsto).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "prevista"
                            ? "bg-blue-100 text-blue-800"
                            : p.status === "suspensa"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {Number(p.valor_elegivel) - Number(p.valor_pago) > 0 ? (
                        <form
                          action={confirmarPagamentoComissaoAction}
                          className="flex min-w-44 gap-2"
                        >
                          <input
                            type="hidden"
                            name="previsao_id"
                            value={p.id}
                          />
                          <input
                            name="valor"
                            defaultValue={(
                              Number(p.valor_elegivel) - Number(p.valor_pago)
                            ).toFixed(2)}
                            className="w-24 rounded border px-2 py-1"
                          />
                          <button className="rounded bg-blue-700 px-2 py-1 text-xs font-bold text-white">
                            Pagar
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Sem saldo elegível
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
