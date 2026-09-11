import { Suspense } from "react";
import { carregarDadosContaCorrenteSocios } from "./actions";
import { ContaCorrenteSociosView } from "@/components/erp/financeiro/conta-corrente-socios-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{
    mes?: string;
    socio?: string;
    tipo_periodo?: string;
    de?: string;
    ate?: string;
    regime?: string;
  }>;
}

export default async function ContaCorrenteSociosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mesParam = params?.mes;
  const socioParam = params?.socio;
  const tipoPeriodoParam = params?.tipo_periodo;
  const deParam = params?.de;
  const ateParam = params?.ate;
  const regimeParam = params?.regime;

  const dados = await carregarDadosContaCorrenteSocios({
    tipoPeriodo: tipoPeriodoParam as any,
    competencia: mesParam,
    dataInicio: deParam,
    dataFim: ateParam,
    socioId: socioParam,
    regime: regimeParam as any,
  });

  return (
    <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Carregando Conta-Corrente dos Sócios...
              </p>
            </div>
          </div>
        }
      >
        <ContaCorrenteSociosView
          dados={dados}
          competencia={dados.competencia}
          socioSelecionadoId={dados.socioSelecionado?.id || socioParam}
          tipoPeriodoInicial={dados.tipoPeriodo}
          dataInicioInicial={dados.dataInicio}
          dataFimInicial={dados.dataFim}
          regimeInicial={dados.regime}
        />
      </Suspense>
    </main>
  );
}
