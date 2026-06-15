import { formatCurrency } from "@/lib/utils/format";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";
import { cn } from "@/lib/utils/cn";

type Props = {
  stepNumber?: number;
  prazos: number[];
  selected: number;
  onSelect: (meses: number) => void;
  parcelaForPrazo: (meses: number) => number;
};

function anosDeMeses(meses: number) {
  const anos = meses / 12;
  return Number.isInteger(anos) ? `${anos} anos` : `${anos.toFixed(1).replace(".", ",")} anos`;
}

export function PrazoStep({
  stepNumber = 4,
  prazos,
  selected,
  onSelect,
  parcelaForPrazo,
}: Props) {
  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>{stepNumber}</span>
        <div>
          <h2 className="text-lg font-bold text-white">Prazo</h2>
          <p className="text-sm text-slate-400">Escolha em quantos meses deseja programar</p>
        </div>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {prazos.map((p) => {
          const sel = selected === p;
          const parcela = parcelaForPrazo(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                choiceCardClass(sel, "min-w-[9.5rem] shrink-0 snap-start p-4 sm:min-w-0"),
              )}
            >
              <p className="text-2xl font-extrabold">{p} meses</p>
              <p className={cn("text-sm font-medium", sel ? "text-slate-800" : "text-slate-400")}>
                {anosDeMeses(p)}
              </p>
              <p
                className={cn(
                  "mt-2 text-xs font-semibold uppercase tracking-wide",
                  sel ? "text-slate-700" : "text-slate-500",
                )}
              >
                Parcela est.
              </p>
              <p className={cn("text-lg font-bold", sel ? "text-slate-900" : "text-amber-400/90")}>
                {formatCurrency(parcela)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
