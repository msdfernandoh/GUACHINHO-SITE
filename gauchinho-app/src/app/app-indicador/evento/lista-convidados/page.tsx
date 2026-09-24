import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, UsersRound } from "lucide-react";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { fetchEventosDisponiveisParaIndicador } from "@/lib/parceiros/eventos-indicador";
import { createAdminClient } from "@/lib/supabase/admin";

const statusLabel: Record<string, string> = { confirmado: "Confirmado", presente: "Presente", pendente: "Pendente", lista_espera: "Lista de espera", cancelado: "Cancelado" };

export default async function ListaConvidadosDoEventoPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  const [tenant, { participante, indicador }, eventos] = await Promise.all([getResolvedTenant(), resolveIndicadorAppSession(empresaAtiva.id, usuario.id), fetchEventosDisponiveisParaIndicador()]);
  if (!participante || !indicador) redirect("/app-indicador");
  const evento = eventos[0];
  const admin = createAdminClient({ noStore: true });
  const { data: lista } = evento ? await admin.from("eventos_listas_convidados").select("id").eq("evento_id", evento.id).eq("consultor_usuario_id", usuario.id).maybeSingle() : { data: null };
  const { data: convidados } = lista ? await admin.from("eventos_listas_convidados_itens").select("id,nome,empresa,telefone,status_presenca,tem_acompanhante,nome_acompanhante,quantidade_vagas,created_at").eq("lista_id", lista.id).order("created_at", { ascending: false }) : { data: [] };
  const vagas = (convidados ?? []).reduce((total, convidado: { quantidade_vagas?: number | null }) => total + Number(convidado.quantidade_vagas ?? 1), 0);

  return <AppIndicadorTheme racon={isRaconModel(tenant?.siteModel)}><main className="min-h-screen bg-zinc-950 px-4 py-5 text-white"><div className="mx-auto max-w-md"><Link href="/app-indicador" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300"><ArrowLeft className="h-4 w-4" />Meu painel</Link><header className="mt-7"><p className="text-xs font-black tracking-[.18em] text-amber-300">MEUS CONVIDADOS</p><h1 className="mt-2 text-3xl font-black">Lista do evento</h1><p className="mt-2 text-sm text-zinc-400">Acompanhe os convidados que você incluiu no evento ativo.</p></header>{evento ? <><section className="mt-6 rounded-3xl border border-amber-400/25 bg-amber-400/10 p-5"><div className="flex gap-3"><CalendarDays className="mt-1 h-5 w-5 text-amber-300" /><div><h2 className="font-black">{evento.nome}</h2><p className="mt-1 text-sm text-zinc-300">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Cuiaba" }).format(new Date(evento.data_evento))}</p><p className="mt-3 text-sm font-bold text-amber-200">{convidados?.length ?? 0} convidado(s) · {vagas} vaga(s) reservada(s)</p></div></div></section><Link href="/app-indicador/indicar?tipo=evento" className="mt-4 flex items-center justify-center rounded-2xl bg-amber-400 px-4 py-4 text-sm font-black text-zinc-950">+ Adicionar convidado</Link><section className="mt-6"><h2 className="text-xl font-black">Seus convidados</h2><div className="mt-3 space-y-3">{(convidados ?? []).map((convidado: { id: string; nome: string; empresa?: string | null; telefone?: string | null; status_presenca: string; tem_acompanhante?: boolean | null; nome_acompanhante?: string | null }) => <article key={convidado.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{convidado.nome}</p><p className="mt-1 text-sm text-zinc-400">{convidado.empresa || convidado.telefone}</p>{convidado.tem_acompanhante ? <p className="mt-2 text-xs font-bold text-zinc-300">Acompanhante: {convidado.nome_acompanhante || "informado"} · 2 vagas</p> : null}</div><span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-300">{statusLabel[convidado.status_presenca] || convidado.status_presenca}</span></div></article>)}{!convidados?.length ? <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-7 text-center text-sm text-zinc-400"><UsersRound className="mx-auto h-8 w-8 text-zinc-600" /><p className="mt-3">Você ainda não adicionou convidados para este evento.</p></div> : null}</div></section></> : <section className="mt-6 rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-7 text-center text-sm text-zinc-400">Não há evento ativo no momento. Seus próximos convites podem ser cadastrados na lista de pendentes.</section>}</div></main></AppIndicadorTheme>;
}
