import type { Modo } from "./simulador-types";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";
import { Building2, Landmark } from "lucide-react";

type Props = {
  value: Modo;
  onChange: (modo: Modo) => void;
};

export function SolutionSelector({ value, onChange }: Props) {
  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>1</span>
        <div>
          <h2 className="text-lg font-bold text-white">Escolha a solução</h2>
          <p className="text-sm text-slate-400">O que você quer simular agora?</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("consorcio")}
          className={choiceCardClass(value === "consorcio", "flex flex-col gap-2 p-5")}
        >
          <Landmark className="h-7 w-7 opacity-90" />
          <span className="text-xl font-bold">Consórcio</span>
          <span className={value === "consorcio" ? "text-sm text-slate-800" : "text-sm text-slate-400"}>
            Planeje, lance e contemple com custo previsível.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange("financiamento")}
          className={choiceCardClass(value === "financiamento", "flex flex-col gap-2 p-5")}
        >
          <Building2 className="h-7 w-7 opacity-90" />
          <span className="text-xl font-bold">Financiamento</span>
          <span
            className={
              value === "financiamento" ? "text-sm text-slate-800" : "text-sm text-slate-400"
            }
          >
            Compra com crédito bancário e parcelas fixas.
          </span>
        </button>
      </div>
    </section>
  );
}
