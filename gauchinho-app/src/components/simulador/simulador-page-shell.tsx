import type { ReactNode } from "react";
import { simuladorShell } from "./simulador-ui";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
};

export function SimuladorPageShell({ children, footer }: Props) {
  const brand = useTenantBrand();
  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 sm:max-w-3xl sm:px-6 sm:pt-10 lg:max-w-4xl">
        <header data-site-block="cabecalho" className="mb-8 text-center sm:mb-10">
          {brand.isGauchinho ? <div className="mb-4 flex justify-center">
            <MascoteGauchinho variant="cta" />
          </div> : null}
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400 sm:text-sm">
            Simulador {brand.nome}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
            Planeje seu{" "}
            <span className="text-amber-400">consórcio</span> ou financiamento
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Resultado imediato. Cadastro apenas para análise completa ou proposta.
          </p>
        </header>
        {children}
      </div>
      {footer}
    </div>
  );
}
