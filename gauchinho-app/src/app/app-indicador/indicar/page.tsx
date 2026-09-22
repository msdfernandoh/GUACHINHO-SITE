import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, UserRoundPlus } from "lucide-react";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { IndicacaoChat } from "@/components/app-indicador/indicacao-chat";
import { IndicacaoEventoForm } from "@/components/app-indicador/indicacao-evento-form";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { fetchEventosDisponiveisParaIndicador } from "@/lib/parceiros/eventos-indicador";

export default async function IndicarNoAppPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  const [{ tipo }, tenant] = await Promise.all([searchParams, getResolvedTenant()]);
  const racon = isRaconModel(tenant?.siteModel);

  if (tipo === "contato") return <IndicacaoChat racon={racon} />;

  if (tipo === "evento") {
    const [{ participante }, eventos] = await Promise.all([
      resolveIndicadorAppSession(empresaAtiva.id, usuario.id),
      fetchEventosDisponiveisParaIndicador(),
    ]);
    return (
      <IndicacaoEventoForm
        racon={racon}
        nomeIndicador={participante?.nome ?? "Indicador"}
        eventos={eventos.map((evento) => ({
          id: evento.id,
          nome: evento.nome,
          dataEvento: evento.data_evento,
          local: evento.local,
          cidade: evento.cidade,
        }))}
      />
    );
  }

  return (
    <AppIndicadorTheme racon={racon}>
      <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/app-indicador" className="text-sm font-bold text-zinc-300">← Meu painel</Link>
          <p className="mt-8 text-xs font-black tracking-[.18em] text-amber-300">NOVA INDICAÇÃO</p>
          <h1 className="mt-2 text-3xl font-black">O que você deseja cadastrar?</h1>
          <p className="mt-2 text-sm text-zinc-400">Escolha o tipo para abrir o formulário correto.</p>
          <div className="mt-7 grid gap-4">
            <Link href="/app-indicador/indicar?tipo=contato" className="rounded-[2rem] border border-zinc-700 bg-zinc-900 p-6 transition hover:border-amber-400">
              <UserRoundPlus className="h-10 w-10 rounded-2xl bg-amber-400 p-2 text-zinc-950" />
              <h2 className="mt-4 text-xl font-black">Contato</h2>
              <p className="mt-1 text-sm text-zinc-400">Cadastrar uma oportunidade de consórcio e acompanhar a negociação.</p>
            </Link>
            <Link href="/app-indicador/indicar?tipo=evento" className="rounded-[2rem] border border-zinc-700 bg-zinc-900 p-6 transition hover:border-amber-400">
              <CalendarDays className="h-10 w-10 rounded-2xl bg-amber-400 p-2 text-zinc-950" />
              <h2 className="mt-4 text-xl font-black">Evento</h2>
              <p className="mt-1 text-sm text-zinc-400">Adicionar um convidado à lista do evento para confirmação.</p>
            </Link>
          </div>
        </div>
      </main>
    </AppIndicadorTheme>
  );
}
