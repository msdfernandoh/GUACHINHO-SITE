import type { Modo, TipoBem } from "./simulador-types";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";
import { Car, Home, Truck, Bike } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TIPO_BEM_LABEL } from "@/lib/simulador/tipos-credito";

type AssetOption = {
  id: TipoBem;
  label: string;
  icon: typeof Home;
};

const CONSORCIO: AssetOption[] = [
  { id: "imovel", label: TIPO_BEM_LABEL.imovel, icon: Home },
  { id: "automovel", label: TIPO_BEM_LABEL.automovel, icon: Car },
  { id: "moto", label: TIPO_BEM_LABEL.moto, icon: Bike },
  { id: "caminhoes_frota", label: TIPO_BEM_LABEL.caminhoes_frota, icon: Truck },
];

const FIN: AssetOption[] = [
  { id: "imovel", label: TIPO_BEM_LABEL.imovel, icon: Home },
  { id: "automovel", label: TIPO_BEM_LABEL.automovel, icon: Car },
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
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(choiceCardClass(selected, "flex flex-col items-center gap-2 p-4 text-center"))}
            >
              <Icon className="h-6 w-6" />
              <span className="font-semibold">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
