import { obterPerfilAcessoApp } from "@/lib/app-indicador/perfil-acesso";
import { resumirIndicacao } from "@/lib/app-indicador/producao";
import Link from "next/link";
import { obterMicrofranquia } from "@/lib/microfranquia/access";
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
  const somenteProducao=await obterPerfilAcessoApp(empresaAtiva.id,usuario.id)==="PRODUCAO";
  const [{ data: indicacoes }, { data: previsoes }, eventoAtivo] = await Promise.all([
    db
      .from("programa_indicacoes")
      .select(
        "id,status,created_at,produto_interesse,credito_desejado,capacidade_mensal,lead:leads(nome,empresa_id,etapa_id,status,fechado),venda:vendas(empresa_id,status,valor_credito)",
      )
      .eq("empresa_id", empresaAtiva.id)
      .eq("indicador_id", indicador?.id ?? "")
      .order("created_at", { ascending: false }),
    somenteProducao ? Promise.resolve({data:[]}) : db
      .from("comissao_previsoes_participantes")
      .select(
        "id,nome_etapa,competencia,valor_previsto,valor_pago,status,conferido_por_participante",
      )
      .eq("empresa_id", empresaAtiva.id)
      .eq("participante_comercial_id", participante.id)
      .neq("status", "cancelada")
      .order("competencia", { ascending: false }),
    somenteProducao ? Promise.resolve(null) : fetchEventoAtivoParaPainelIndicador(),
  ]);
  const {data:etapas,error:erroEtapas}=await db.from("crm_funil_etapas").select("id,nome").eq("empresa_id",empresaAtiva.id);
  if(erroEtapas)throw new Error("Não foi possível carregar as etapas do funil.");
  const mapaEtapas=new Map((etapas??[]).map(e=>[e.id,e.nome]));
  const producao=(indicacoes??[]).map(i=>resumirIndicacao(empresaAtiva.id,i,mapaEtapas));
  const total = (previsoes ?? []).reduce(
    (s, p) => s + Number(p.valor_previsto ?? 0),
    0,
  );
  const pago = (previsoes ?? []).reduce(
    (s, p) => s + Number(p.valor_pago ?? 0),
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
  const microfranquia=somenteProducao?null:await obterMicrofranquia(empresaAtiva.id,participante.id);
  const modelos: Record<string, string> = {
    MICROFRANQUEADO: "Microfranqueado",
    GERADOR_NEGOCIOS: "Gerador de Negócios",
    GERADOR_POSSIBILIDADES: participante.gestor_participante_id ? "Gerador de Oportunidades" : "Gerador de Possibilidades",
    CONVERSAR_EQUIPE: "Em definição com a equipe",
  };
  const modeloNegocio = microfranquia ? "Microfranqueado" :
    modelos[indicador?.modelo_interesse ?? ""] ?? "Gerador de Possibilidades";
  return (
    <AppIndicadorTheme racon={racon}>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-400">
              Olá, {participante.nome.split(" ")[0]}
            </p>
            <h1 className="text-3xl font-black">{somenteProducao?"Minhas indicações":"Meu negócio"}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {somenteProducao?"Acompanhe suas indicações e o andamento das negociações.":"Seu painel de indicações, negociações e comissões."}
            </p>
            <span className="mt-3 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
              {somenteProducao?"Colaborador — somente produção":modeloNegocio}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2"><Link href="/definir-senha?next=/app-indicador&modo=alterar" className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold">Mudar senha</Link><form action={logoutIndicadorAction}>
            <button
              type="submit"
              className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200"
            >
              Trocar usuário
            </button>
          </form></div>
        </header>
      <div className={`mt-6 grid gap-3 ${somenteProducao?"grid-cols-1":"grid-cols-2"}`}>
        <Link
          href="/app-indicador/indicar"
            className="rounded-2xl bg-amber-500 p-5 font-black text-zinc-950"
          >
            + Nova indicação
          </Link>
          {!somenteProducao&&<Link
            href="/app-indicador/comissoes"
            className="rounded-2xl border border-zinc-700 p-5 font-black"
          >
          Minhas comissões
        </Link>}
      </div>
      {!somenteProducao&&<><Link
        href="/parceiros"
        className="mt-3 flex rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-300 transition hover:bg-amber-400/20"
      >
        Conheça os nossos programas
      </Link>
      <nav className="mt-3 grid grid-cols-2 gap-3"><Link href="/app-indicador/simulacao" className="rounded-2xl border p-4 font-bold">Simulação</Link><Link href="/app-indicador/parceria" className="rounded-2xl border p-4 font-bold">Recebimento e parceria</Link></nav>
      {microfranquia&&<Link href="/app-indicador/equipe" className="mt-3 flex rounded-2xl border border-zinc-700 p-5 font-black">Minha equipe · colaboradores e resultados</Link>}
      <Link href="/app-indicador/equipe-fixa" className="mt-3 flex rounded-2xl border p-5 font-black">Colaboradores fixos · link de cadastro e produção</Link></>}
      <InstalarAppIndicadorCard />
      {linkIndicacao && (
          <IndicadorLinkCard
            url={linkIndicacao}
            titulo="Link para novos interessados"
            descricao="Abre o formulário com as perguntas estratégicas e vincula o lead a você."
          />
        )}
        {!somenteProducao && linkNetwork && (
          <IndicadorLinkCard
            url={linkNetwork}
            titulo="Convite do Network de Negócios"
            descricao="Compartilhe para confirmar presença no encontro de 29 de setembro, às 19h."
          />
        )}
        {somenteProducao?<section className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-zinc-900 p-4"><p>Indicações produzidas</p><b className="text-xl">{producao.length}</b></div><div className="rounded-2xl bg-zinc-900 p-4"><p>Negócios fechados</p><b className="text-xl">{producao.filter(i=>i.fechado).length}</b></div></section>:<section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Comissões geradas</p>
            <b className="text-xl">{brl(total)}</b>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Já recebido</p>
            <b className="text-xl">{brl(pago)}</b>
          </div>
        </section>}
        {eventoAtivo ? <section className="evento-app mt-6 rounded-[2rem] border border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-zinc-900 p-5">
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
            {producao.map(i=><article key={i.id} className="rounded-2xl bg-zinc-900 p-4"><b>{i.nome}</b><p className="mt-2 text-xs text-zinc-400">Etapa do funil</p><p className="text-sm font-bold text-amber-300">{i.etapa}</p><p className="mt-2 text-xs text-zinc-400">{i.produto??"Interesse não informado"}</p>{!somenteProducao&&<p className="mt-1 text-xs text-zinc-400">Crédito desejado: {i.creditoDesejado?brl(Number(i.creditoDesejado)):"—"}</p>}{i.fechado&&<p className="mt-2 font-bold">Valor fechado: {i.valorFechado==null?"A confirmar":brl(i.valorFechado)}</p>}</article>)}
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
