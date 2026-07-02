import Link from "next/link";
import { notFound } from "next/navigation";
import {
  agendarRetornoAction,
  cancelAtividadeAction,
  completeAtividadeAction,
  createAtividadeAction,
  deleteLeadAction,
  fecharLeadAction,
  fetchLeadDetail,
  fetchSrdOptions,
  updateLeadAction,
} from "../actions";
import { MOTIVOS_PERDA } from "@/lib/crm/constants";
import { gerarPropostaFromCartaLeadAction } from "@/app/admin/cartas-contempladas/actions";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { PRODUTOS_FECHADOS, TIPOS_INTERESSE } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { IaLeadSummarySection } from "../ia-lead-summary";
import { FUNNEL_STATUSES, LEAD_TEMPERATURES } from "@/lib/crm/constants";
import { LeadStatusBadge } from "@/components/admin/crm/lead-status-badge";
import { LeadTemperatureBadge } from "@/components/admin/crm/lead-temperature-badge";
import { LeadWhatsappButton } from "@/components/admin/crm/lead-whatsapp-button";
import { LeadActivityTimeline } from "@/components/admin/crm/lead-activity-timeline";
import { LeadActivityForm } from "@/components/admin/crm/lead-activity-form";
import { fetchCompromissosLead } from "@/app/admin/agenda/actions";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioNegocio();
  let detail;
  try {
    detail = await fetchLeadDetail(id);
  } catch {
    notFound();
  }
  const { lead, historico, propostas, iaConversa, iaMensagens, atividades, timeline } = detail;
  const srds = await fetchSrdOptions();
  const agendaItens = await fetchCompromissosLead(id);
  const podeExcluir = canDeleteRecords(usuario?.perfil);
  const leadEvento = lead as typeof lead & {
    evento_id?: string | null;
    evento_nome?: string | null;
    parceiro_indicador_nome?: string | null;
    parceiro_indicador_empresa?: string | null;
  };

  const updateWithId = updateLeadAction.bind(null, id);
  const retornoWithId = agendarRetornoAction.bind(null, id);
  const fecharWithId = fecharLeadAction.bind(null, id);
  const deleteWithId = deleteLeadAction.bind(null, id);
  const gerarPropostaCarta = gerarPropostaFromCartaLeadAction.bind(null, id);
  const createAtividade = createAtividadeAction.bind(null, id);
  const podeGerarPropostaCarta =
    !!lead.carta_contemplada_id || lead.tipo_interesse === "carta_contemplada";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-sm text-amber-400 hover:underline">
            ← Leads
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">{lead.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadTemperatureBadge value={lead.temperatura} />
            <span className="text-sm text-zinc-500">{formatDate(lead.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LeadWhatsappButton
            nome={lead.nome}
            whatsapp={lead.whatsapp}
            produto={lead.produto_interesse ?? lead.tipo_interesse}
            leadId={lead.id}
          />
          {podeExcluir ? (
            <form action={deleteWithId}>
              <Button type="submit" variant="danger" size="sm">
                Excluir (Master)
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {leadEvento.origem === "evento" || leadEvento.evento_nome ? (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-zinc-200">
          <p>
            <span className="font-semibold text-amber-300">Evento de origem:</span>{" "}
            {leadEvento.evento_nome ?? "—"}
          </p>
          {leadEvento.parceiro_indicador_nome ? (
            <p className="mt-1">
              <span className="font-semibold">Quem convidou:</span> {leadEvento.parceiro_indicador_nome}
              {leadEvento.parceiro_indicador_empresa ? ` (${leadEvento.parceiro_indicador_empresa})` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-zinc-100">Agenda</h2>
          <Link href={`/admin/agenda?lead=${id}`} className="text-sm text-amber-400 hover:underline">
            Agendar compromisso →
          </Link>
        </div>
        {agendaItens.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nenhum compromisso vinculado.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {agendaItens.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <span>
                  {c.titulo} — {formatDateTime(c.data_inicio, null)} ({c.status})
                </span>
                {c.resultado ? <span className="text-zinc-500">{c.resultado}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={updateWithId}
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
        >
          <h2 className="font-semibold text-zinc-100">Dados comerciais</h2>
          <div>
            <Label>Nome</Label>
            <Input name="nome" defaultValue={lead.nome} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>WhatsApp</Label>
              <Input name="whatsapp" defaultValue={lead.whatsapp ?? ""} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input name="email" defaultValue={lead.email ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cidade</Label>
              <Input name="cidade" defaultValue={lead.cidade ?? ""} />
            </div>
            <div>
              <Label>Valor estimado</Label>
              <Input
                name="valor_estimado"
                type="number"
                step="0.01"
                defaultValue={lead.valor_estimado ?? lead.valor_simulado ?? ""}
              />
            </div>
          </div>
          <div>
            <Label>Status (funil)</Label>
            <Select name="status" defaultValue={lead.status}>
              {FUNNEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Temperatura</Label>
            <Select name="temperatura" defaultValue={lead.temperatura ?? ""}>
              <option value="">—</option>
              {LEAD_TEMPERATURES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Consultor responsável</Label>
            <Select name="srd_responsavel_id" defaultValue={lead.srd_responsavel_id ?? ""}>
              <option value="">Sem responsável</option>
              {srds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
            <input type="hidden" name="srd_responsavel_nome" value="" />
          </div>
          <div>
            <Label>Próxima ação</Label>
            <Input name="proxima_acao" defaultValue={lead.proxima_acao ?? ""} />
          </div>
          <div>
            <Label>Data próxima ação</Label>
            <Input
              name="data_proxima_acao"
              type="datetime-local"
              defaultValue={lead.data_proxima_acao?.slice(0, 16) ?? ""}
            />
          </div>
          <div>
            <Label>Produto interesse</Label>
            <Input name="produto_interesse" defaultValue={lead.produto_interesse ?? ""} />
          </div>
          <div>
            <Label>Tipo interesse</Label>
            <Select name="tipo_interesse" defaultValue={lead.tipo_interesse ?? ""}>
              <option value="">—</option>
              {TIPOS_INTERESSE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea name="observacoes" rows={3} defaultValue={lead.observacoes ?? ""} />
          </div>
          <input type="hidden" name="origem" value={lead.origem ?? ""} />
          <Button type="submit" size="sm">
            Salvar alterações
          </Button>
        </form>

        <div className="space-y-6">
          <LeadActivityForm action={createAtividade} />

          <form
            action={retornoWithId}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <h2 className="font-semibold text-zinc-100">Agendar retorno (legado)</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  name="proximo_retorno_data"
                  type="date"
                  defaultValue={lead.proximo_retorno_data ?? ""}
                />
              </div>
              <div>
                <Label>Hora</Label>
                <Input
                  name="proximo_retorno_hora"
                  type="time"
                  defaultValue={lead.proximo_retorno_hora?.slice(0, 5) ?? ""}
                />
              </div>
            </div>
            <Textarea name="retorno_observacao" rows={2} defaultValue={lead.retorno_observacao ?? ""} />
            <Button type="submit" size="sm">
              Salvar retorno
            </Button>
          </form>

          <form
            action={fecharWithId}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <h2 className="font-semibold text-zinc-100">Fechamento</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data fechamento</Label>
                <Input name="data_fechamento" type="date" />
              </div>
              <div>
                <Label>Valor fechado</Label>
                <Input name="valor_fechado" type="number" step="0.01" required />
              </div>
            </div>
            <div>
              <Label>Produto fechado</Label>
              <Select name="produto_fechado" defaultValue="" required>
                <option value="">—</option>
                {PRODUTOS_FECHADOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea name="observacao_fechamento" rows={2} />
            </div>
            <input type="hidden" name="fechado" value="true" />
            <Button type="submit" variant="gold" size="sm">
              Marcar como fechado
            </Button>
          </form>

          <form
            action={fecharWithId}
            className="space-y-3 rounded-xl border border-red-900/50 bg-zinc-900/60 p-4"
          >
            <h2 className="font-semibold text-red-400">Perda</h2>
            <div>
              <Label>Motivo</Label>
              <Select name="motivo_perda" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea name="observacao_perda" rows={2} placeholder="Observação opcional" />
            <input type="hidden" name="perdido" value="true" />
            <Button type="submit" variant="danger" size="sm">
              Marcar perdido
            </Button>
          </form>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 font-semibold text-zinc-100">Atividades</h2>
        <ul className="space-y-2 text-sm">
          {atividades.map((a) => {
            const complete = completeAtividadeAction.bind(null, a.id, id);
            const cancel = cancelAtividadeAction.bind(null, a.id, id);
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-zinc-200">
                    {a.tipo} — {a.titulo ?? "Sem título"}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">{a.status}</span>
                  {a.data_agendada ? (
                    <p className="text-xs text-zinc-600">{formatDate(a.data_agendada)}</p>
                  ) : null}
                </div>
                {a.status === "pendente" ? (
                  <div className="flex gap-2">
                    <form action={complete}>
                      <Button type="submit" size="sm" variant="outline">
                        Concluir
                      </Button>
                    </form>
                    <form action={cancel}>
                      <Button type="submit" size="sm" variant="outline">
                        Cancelar
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
          {!atividades.length ? <p className="text-zinc-500">Nenhuma atividade</p> : null}
        </ul>
      </section>

      <IaLeadSummarySection
        lead={lead as Record<string, unknown>}
        iaConversa={iaConversa as Record<string, unknown> | null}
        iaMensagens={(iaMensagens ?? []) as Array<Record<string, unknown>>}
      />

      <section>
        <h2 className="mb-2 font-semibold text-zinc-100">Propostas</h2>
        {podeGerarPropostaCarta ? (
          <form action={gerarPropostaCarta} className="mb-3">
            <Button type="submit" variant="gold" size="sm">
              Gerar proposta (carta contemplada)
            </Button>
          </form>
        ) : null}
        <ul className="space-y-2 text-sm">
          {propostas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2"
            >
              <Link href={`/admin/propostas/${p.id}`} className="font-medium text-amber-400 hover:underline">
                {formatDate(p.created_at)} — {p.tipo_proposta ?? "Proposta"} — {p.status}
              </Link>
              <span>{formatCurrency(Number(p.valor_credito))}</span>
            </li>
          ))}
          {propostas.length === 0 ? <p className="text-zinc-500">Nenhuma proposta</p> : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-semibold text-zinc-100">Histórico comercial</h2>
        <LeadActivityTimeline items={timeline} />
      </section>
    </div>
  );
}
