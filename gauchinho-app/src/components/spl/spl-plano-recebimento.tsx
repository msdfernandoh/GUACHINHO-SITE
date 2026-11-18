"use client";

import { useState } from "react";
import { CalculadoraComissao } from "@/app/app-indicador/simulacao/calculadora";
import { MODELO_RECEBIMENTO_SPL } from "@/lib/spl/dashboard";
import { MODELOS_PARCERIA, type ModeloParceria } from "@/lib/spl/types";
import { Cartao } from "./spl-ui";

const modelosRemunerados = MODELOS_PARCERIA.filter(({ value }) => MODELO_RECEBIMENTO_SPL[value]);

export function PlanoRecebimentoSpl({ modelo }: { modelo: ModeloParceria | null }) {
  const [referencia, setReferencia] = useState<ModeloParceria>("GERADOR_OPORTUNIDADES");
  const modeloExibido = modelo ?? referencia;
  const plano = MODELO_RECEBIMENTO_SPL[modeloExibido];

  return (
    <Cartao>
      <h3 className="text-xl font-black text-[#0A1931]">Plano de recebimento</h3>
      {!modelo && (
        <>
          <p className="mt-2 text-sm text-slate-700">
            Esta imobiliária ainda está sem modelo de parceria definido. Escolha um modelo para simular o recebimento.
            A seleção vale apenas para esta consulta.
          </p>
          <label className="mt-4 block text-sm font-bold text-slate-900">
            Modelo para simulação
            <select
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3"
              value={referencia}
              onChange={(event) => {
                const selecionado = modelosRemunerados.find(({ value }) => value === event.target.value);
                if (selecionado) setReferencia(selecionado.value);
              }}
            >
              {modelosRemunerados.map(({ value, label, percentual }) => (
                <option key={value} value={value}>{label} · {percentual}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {plano ? (
        <div className="text-white">
          <CalculadoraComissao modelo={plano} oportunidades={modeloExibido === "GERADOR_OPORTUNIDADES"} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-700">A liberação de carteira não tem plano de remuneração.</p>
      )}
    </Cartao>
  );
}
