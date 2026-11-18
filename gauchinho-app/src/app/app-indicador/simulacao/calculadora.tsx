"use client";

import { useState } from "react";
import { formatBRL, parseBRLMoney } from "@/lib/formatters/money";
import { MODELOS_PROGRAMA_PARCEIROS, type ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
import { calcularPlano, type ProdutoParceria, type FaixaParceria } from "@/lib/parceiros/plano-recebimento";

const campo = "mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200";

export function CalculadoraComissao({ modelo, oportunidades = false }: { modelo: ModeloParceiroId; oportunidades?: boolean }) {
  const [valor, setValor] = useState("");
  const [produto, setProduto] = useState<ProdutoParceria>("IMOVEIS");
  const [faixa, setFaixa] = useState<FaixaParceria>("INTEGRAL");
  const valorLimpo = valor.trim().replace(/^R\$\s*/i, "");
  const numero = /^\d+$/.test(valorLimpo)
    ? Number(valorLimpo)
    : /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(valorLimpo)
      ? parseBRLMoney(valorLimpo)
      : /^\d+\.\d{1,2}$/.test(valorLimpo) ? Number(valorLimpo) : null;
  const valido = numero !== null && Number.isFinite(numero) && numero >= 0 && numero <= 1e12;
  const plano = calcularPlano(modelo, produto, faixa, valido ? numero : 0);
  const dados = MODELOS_PROGRAMA_PARCEIROS.find((item) => item.id === modelo)!;
  const invalido = valor.trim() !== "" && !valido;

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Simulação de comissão</h1>
        <p className="mt-1 text-sm text-slate-700">
          {oportunidades && modelo === "GERADOR_POSSIBILIDADES" ? "Gerador de Oportunidades" : dados.nome} · {dados.ganho} da base líquida
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Produto
          <select className={campo} value={produto} onChange={(event) => setProduto(event.target.value as ProdutoParceria)}>
            <option value="IMOVEIS">Imóveis · 4% da franquia</option>
            <option value="VEICULOS">Veículos · 3,5% da franquia</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Plano do cliente
          <select className={campo} value={faixa} onChange={(event) => setFaixa(event.target.value as FaixaParceria)}>
            <option value="INTEGRAL">Integral</option>
            <option value="60_99">60% a 99%</option>
            <option value="ABAIXO_59">Abaixo de 59%</option>
          </select>
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          Valor do crédito vendido
          <input
            className={`${campo} text-lg font-bold tabular-nums placeholder:font-normal placeholder:text-slate-500`}
            type="text"
            inputMode="decimal"
            placeholder="R$ 3.000,00"
            aria-invalid={invalido}
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            onFocus={() => { if (valido) setValor(String(numero).replace(".", ",")); }}
            onBlur={() => { if (valido) setValor(formatBRL(numero)); }}
          />
          {invalido && <span role="alert" className="mt-1 block text-sm font-normal text-red-700">Informe um valor válido, como R$ 3.000,00.</span>}
        </label>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-700">Participação bruta</dt>
          <dd className="mt-1 font-bold tabular-nums">{formatBRL(plano.bruto)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-700">Impostos (17,5%)</dt>
          <dd className="mt-1 font-bold tabular-nums">{formatBRL(plano.impostos)}</dd>
        </div>
        <div className="rounded-xl bg-[#153E90] p-4 text-white">
          <dt className="text-sm font-semibold">Líquido</dt>
          <dd className="mt-1 text-xl font-black tabular-nums">{formatBRL(plano.total)}</dd>
        </div>
      </dl>

      <div>
        <h2 className="text-xl font-black text-slate-950">Plano de recebimento</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {modelo === "MICROFRANQUEADO"
            ? "50% de cada etapa da tabela da franquia, com desconto de impostos. A etapa Contemplação depende da contemplação do cliente."
            : "Parcelas mensais iguais, com ajuste de centavos quando necessário."}
          {" "}Pagamento no dia 20 após o pagamento da primeira parcela do cliente, respeitando os marcos da tabela e a confirmação de recebimento.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="bg-blue-50 text-slate-800">
              <tr>
                <th scope="col" className="px-3 py-3">Etapa do cliente / parcela</th>
                <th scope="col" className="px-3 py-3 text-right">% bruto do crédito</th>
                <th scope="col" className="px-3 py-3 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {plano.etapas.map((etapa) => (
                <tr key={etapa.etapa} className="even:bg-slate-50">
                  <th scope="row" className="px-3 py-3 font-medium">{etapa.etapa}</th>
                  <td className="px-3 py-3 text-right tabular-nums">{etapa.percentualBruto.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{formatBRL(etapa.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Estimativa pelas tabelas de referência informadas. O valor efetivo depende da regra vigente, recebimento da administradora e eventuais estornos. Esta simulação não altera comissões ou pagamentos registrados.
        </p>
      </div>
    </section>
  );
}
