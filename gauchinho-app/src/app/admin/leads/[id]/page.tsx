import Link from "next/link";
import { notFound } from "next/navigation";
import {
  agendarRetornoAction,
  deleteLeadAction,
  fecharLeadAction,
  fetchLeadDetail,
  updateLeadAction,
} from "../actions";
import { gerarPropostaFromCartaLeadAction } from "@/app/admin/cartas-contempladas/actions";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { PRODUTOS_FECHADOS, TIPOS_INTERESSE } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { IaLeadSummarySection } from "../ia-lead-summary";

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
  const { lead, historico, propostas, iaConversa, iaMensagens } = detail;
  const podeExcluir = canDeleteRecords(usuario?.perfil);

  const updateWithId = updateLeadAction.bind(null, id);
  const retornoWithId = agendarRetornoAction.bind(null, id);
  const fecharWithId = fecharLeadAction.bind(null, id);
  const deleteWithId = deleteLeadAction.bind(null, id);
  const gerarPropostaCarta = gerarPropostaFromCartaLeadAction.bind(null, id);
  const podeGerarPropostaCarta =
    !!lead.carta_contemplada_id || lead.tipo_interesse === "carta_contemplada";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-sm text-amber-600 hover:underline">
            ← Leads
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{lead.nome}</h1>
          <p className="text-sm text-zinc-500">
            {lead.status} · {formatDate(lead.created_at)}
          </p>
        </div>
        {podeExcluir ? (
          <form action={deleteWithId}>
            <Button type="submit" variant="danger" size="sm">
              Excluir (Master)
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateWithId} className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Dados do lead</h2>
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
          <div>
            <Label>Status</Label>
            <Input name="status" defaultValue={lead.status} />
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
          <input type="hidden" name="cidade" value={lead.cidade ?? ""} />
          <input type="hidden" name="origem" value={lead.origem ?? ""} />
          <input type="hidden" name="srd_responsavel_id" value={lead.srd_responsavel_id ?? ""} />
          <input type="hidden" name="srd_responsavel_nome" value={lead.srd_responsavel_nome ?? ""} />
          <Button type="submit" size="sm">
            Salvar alterações
          </Button>
        </form>

        <div className="space-y-6">
          <form action={retornoWithId} className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Agendar retorno</h2>
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
            <div>
              <Label>Observação</Label>
              <Textarea name="retorno_observacao" rows={2} defaultValue={lead.retorno_observacao ?? ""} />
            </div>
            <Button type="submit" size="sm">
              Salvar retorno
            </Button>
          </form>

          <form action={fecharWithId} className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Fechamento</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data fechamento</Label>
                <Input name="data_fechamento" type="date" />
              </div>
              <div>
                <Label>Valor fechado</Label>
                <Input name="valor_fechado" type="number" step="0.01" />
              </div>
            </div>
            <div>
              <Label>Produto fechado</Label>
              <Select name="produto_fechado" defaultValue="">
                <option value="">—</option>
                {PRODUTOS_FECHADOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <input type="hidden" name="fechado" value="true" />
            <Button type="submit" variant="gold" size="sm">
              Marcar como fechado
            </Button>
          </form>

          <form action={fecharWithId} className="space-y-3 rounded-xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-zinc-900">
            <h2 className="font-semibold text-red-700">Perda</h2>
            <div>
              <Label>Motivo perda</Label>
              <Textarea name="motivo_perda" rows={2} required />
            </div>
            <input type="hidden" name="perdido" value="true" />
            <Button type="submit" variant="danger" size="sm">
              Marcar perdido
            </Button>
          </form>
        </div>
      </div>

      <IaLeadSummarySection
        lead={lead as Record<string, unknown>}
        iaConversa={iaConversa as Record<string, unknown> | null}
        iaMensagens={(iaMensagens ?? []) as Array<Record<string, unknown>>}
      />

      <section>
        <h2 className="mb-2 font-semibold">Propostas</h2>
        {podeGerarPropostaCarta ? (
          <form action={gerarPropostaCarta} className="mb-3">
            <Button type="submit" variant="gold" size="sm">
              Gerar proposta (carta contemplada)
            </Button>
          </form>
        ) : null}
        <ul className="space-y-2 text-sm">
          {propostas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 dark:border-zinc-800">
              <Link href={`/admin/propostas/${p.id}`} className="font-medium text-amber-600 hover:underline">
                {formatDate(p.created_at)} — {p.tipo_proposta ?? "Proposta"} — {p.status}
              </Link>
              <span>{formatCurrency(Number(p.valor_credito))}</span>
              {p.pdf_url ? (
                <a
                  href={`/api/propostas/${p.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 underline"
                >
                  Baixar PDF
                </a>
              ) : (
                <Link href={`/admin/propostas/${p.id}`} className="text-zinc-500 underline">
                  Gerar PDF
                </Link>
              )}
            </li>
          ))}
          {propostas.length === 0 ? <p className="text-zinc-500">Nenhuma proposta</p> : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Histórico</h2>
        <ul className="space-y-2 text-sm">
          {historico.map((h) => (
            <li key={h.id} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="font-medium">{h.acao}</span> — {formatDate(h.created_at)}
              {h.descricao ? <p className="text-zinc-500">{h.descricao}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
