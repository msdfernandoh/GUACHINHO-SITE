import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { logoutIndicadorAction } from "./login/actions";
import { IndicadorLinkCard } from "@/components/app-indicador/indicador-link-card";
import { InstalarAppIndicadorCard } from "@/components/app-indicador/instalar-app-indicador-card";
import { headers } from "next/headers";
import { fetchEventoAtivoParaPainelIndicador } from "@/lib/parceiros/eventos-indicador";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );
export default async function AppIndicadorPage() {
  const tenant = await getResolvedTenant();
  const racon = isRaconModel(tenant?.siteModel);
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  const db = createAdminClient({ noStore: true });
  const { participante, indicador } = await resolveIndicadorAppSession(
    empresaAtiva.id,
    usuario.id,
  );
  if (!participante || !indicador)
    return (
      <main className="p-6">
        Seu acesso ainda não está vinculado ao programa.
      </main>
    );
  const [{ data: indicacoes }, { data: previsoes }, eventoAtivo] = await Promise.all([
    db
      .from("programa_indicacoes")
      .select(
        "id,status,created_at,produto_interesse,credito_desejado,capacidade_mensal,lead:leads(nome,status),venda:vendas(valor_credito)",
      )
      .eq("empresa_id", empresaAtiva.id)
      .eq("indicador_id", indicador?.id ?? "")
      .order("created_at", { ascending: false }),
    db
      .from("comissao_previsoes_participantes")
      .select(
        "id,nome_etapa,competencia,valor_previsto,valor_pago,status,conferido_por_participante",
      )
      .eq("empresa_id", empresaAtiva.id)
      .eq("participante_comercial_id", participante.id)
      .neq("status", "cancelada")
      .order("competencia", { ascending: false }),
    fetchEventoAtivoParaPainelIndicador(),
  ]);
  const total = (previsoes ?? []).reduce(
    (s: any, p: any) => s + Number(p.valor_previsto ?? 0),
    0,
  );
  const pago = (previsoes ?? []).reduce(
    (s: any, p: any) => s + Number(p.valor_pago ?? 0),
    0,
  );
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  )
    .split(",")[0]
    .trim();
  const protocolo = (requestHeaders.get("x-forwarded-proto") ?? "https")
    .split(",")[0]
    .trim();
  const linkIndicacao =
    indicador?.codigo_indicacao_curto && host
      ? `${protocolo}://${host}/i/${indicador.codigo_indicacao_curto}`
      : null;
  const linkNetwork =
    indicador?.codigo_indicacao_curto && host
      ? `${protocolo}://${host}/network/${indicador.codigo_indicacao_curto}`
      : null;
  const modelos: Record<string, string> = {
    MICROFRANQUEADO: "Microfranqueado",
    GERADOR_NEGOCIOS: "Gerador de Negócios",
    GERADOR_POSSIBILIDADES: "Gerador de Possibilidades",
    CONVERSAR_EQUIPE: "Em definição com a equipe",
  };
  const modeloNegocio =
    modelos[indicador?.modelo_interesse ?? ""] ?? "Gerador de Possibilidades";
  return (
    <AppIndicadorTheme racon={racon}>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-400">
              Olá, {participante.nome.split(" ")[0]}
            </p>
            <h1 className="text-3xl font-black">Meu negócio</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Seu painel de indicações, negociações e comissões.
            </p>
            <span className="mt-3 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
              {modeloNegocio}
            </span>
          </div>
          <form action={logoutIndicadorAction}>
            <button
              type="submit"
              className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200"
            >
              Trocar usuário
            </button>
          </form>
        </header>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/app-indicador/indicar"
            className="rounded-2xl bg-amber-500 p-5 font-black text-zinc-950"
          >
            + Nova indicação
          </Link>
          <Link
            href="/app-indicador/comissoes"
            className="rounded-2xl border border-zinc-700 p-5 font-black"
          >
          Minhas comissões
        </Link>
      </div>
      <Link
        href="/parceiros"
        className="mt-3 flex rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-300 transition hover:bg-amber-400/20"
      >
        Conheça os nossos programas
      </Link>
      <InstalarAppIndicadorCard />
      {linkIndicacao && (
          <IndicadorLinkCard
            url={linkIndicacao}
            titulo="Link para novos interessados"
            descricao="Abre o formulário com as perguntas estratégicas e vincula o lead a você."
          />
        )}
        {linkNetwork && (
          <IndicadorLinkCard
            url={linkNetwork}
            titulo="Convite do Network de Negócios"
            descricao="Compartilhe para confirmar presença no encontro de 29 de setembro, às 19h."
          />
        )}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Comissões geradas</p>
            <b className="text-xl">{brl(total)}</b>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Já recebido</p>
            <b className="text-xl">{brl(pago)}</b>
          </div>
        </section>
        {eventoAtivo ? <section className="mt-6 rounded-[2rem] border border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-zinc-900 p-5">
          <p className="text-xs font-black tracking-[.16em] text-amber-300">EVENTO ATIVO</p>
          <h2 className="mt-2 text-2xl font-black">{eventoAtivo.nome}</h2>
          <p className="mt-2 text-sm text-zinc-200">{eventoAtivo.data_evento ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(new Date(eventoAtivo.data_evento)) : "Data e horário a confirmar"}</p>
          <p className="mt-3 text-lg font-black text-amber-300">{eventoAtivo.vagas_disponiveis == null ? "Vagas sem limite definido" : `${eventoAtivo.vagas_disponiveis} vaga${eventoAtivo.vagas_disponiveis === 1 ? "" : "s"} ${eventoAtivo.vagas_disponiveis === 1 ? "disponível" : "disponíveis"}`}</p>
          <div className="mt-4 flex flex-wrap gap-3"><Link href="/app-indicador/indicar?tipo=evento" className="inline-flex rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950">Convidar para este evento</Link><Link href="/app-indicador/evento/lista-convidados" className="inline-flex rounded-xl border border-zinc-600 px-4 py-3 text-sm font-black text-zinc-100">Lista de convidados</Link></div>
        </section> : null}
        <section className="mt-6">
          <h2 className="text-xl font-black">Meus indicados</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Acompanhe a negociação sem expor informações sensíveis.
          </p>
          <div className="mt-3 space-y-3">
            {(indicacoes ?? []).map((i: any) => {
              const lead = Array.isArray(i.lead) ? i.lead[0] : i.lead;
              const venda = Array.isArray(i.venda) ? i.venda[0] : i.venda;
              return (
                <article key={i.id} className="rounded-2xl bg-zinc-900 p-4">
                  <b>{lead?.nome ?? "Indicado"}</b>
                  <p className="mt-1 text-sm text-amber-300">
                    {lead?.status ?? i.status}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {i.produto_interesse ?? "Interesse não informado"} ·
                    Desejado:{" "}
                    {i.credito_desejado ? brl(Number(i.credito_desejado)) : "—"}{" "}
                    · Contratado:{" "}
                    {venda?.valor_credito
                      ? brl(Number(venda.valor_credito))
                      : "Ainda não fechado"}
                  </p>
                </article>
              );
            })}
            {!(indicacoes ?? []).length && (
              <p className="rounded-2xl bg-zinc-900 p-5 text-sm text-zinc-400">
                Você ainda não cadastrou indicações.
              </p>
            )}
          </div>
        </section>
      </main>
    </AppIndicadorTheme>
  );
}
