import type { Modo, TipoBem } from "./simulador-types";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";
import { Car, Home, Truck, Bike } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type AssetOption = {
  id: TipoBem;
  label: string;
  icon: typeof Home;
  soon?: boolean;
};

const CONSORCIO: AssetOption[] = [
  { id: "imovel", label: "Imóvel", icon: Home },
  { id: "automovel", label: "Automóvel", icon: Car },
  { id: "moto", label: "Moto", icon: Bike, soon: true },
  { id: "caminhonete", label: "Caminhonete", icon: Truck, soon: true },
];

const FIN: AssetOption[] = [
  { id: "imovel", label: "Imóvel", icon: Home },
  { id: "automovel", label: "Automóvel", icon: Car },
];

type Props = {
  modo: Modo;
  value: TipoBem;
  onChange: (tipo: TipoBem) => void;
};

export function AssetTypeSelector({ modo, value, onChange }: Props) {
  const options = modo === "consorcio" ? CONSORCIO : FIN;

  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>2</span>
        <div>
          <h2 className="text-lg font-bold text-white">Escolha o bem</h2>
          <p className="text-sm text-slate-400">
            {modo === "consorcio" ? "Tipo de crédito no consórcio" : "O que você pretende financiar"}
          </p>
        </div>
      </div>
      <div className={cn("grid gap-3", modo === "consorcio" ? "grid-cols-2" : "grid-cols-2")}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = value === opt.id && !opt.soon;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={opt.soon}
              onClick={() => !opt.soon && onChange(opt.id)}
              className={cn(
                choiceCardClass(selected, "flex flex-col items-center gap-2 p-4 text-center"),
                opt.soon && "cursor-not-allowed opacity-50",
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="font-semibold">{opt.label}</span>
              {opt.soon ? (
                <span className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
                  Em breve
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
