import Link from "next/link";
import { ArrowLeft, FileText, Pencil, Plus, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { inativarClienteAction } from "../actions";
import { CotaContemplacaoForm } from "@/components/erp/cota-contemplacao-form";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();
  if (!empresaAtiva) return null;
  const [
    clienteResult,
    propostasResult,
    contratacoesResult,
    vendasResult,
    historicoResult,
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle(),
    supabase
      .from("propostas")
      .select("id,status,nome_cliente,created_at,valor_credito,tipo_bem")
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contratacoes_online")
      .select(
        "id,protocolo,status,contrato_assinado,contrato_assinado_em,created_at",
      )
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vendas")
      .select(
        "id,data_venda,status,valor_credito,administradoras(nome),grupos_consorcio(codigo_grupo),cotas_definitivas(id,numero_cota,status,parcela,contemplada,data_contemplacao,valor_credito_contemplacao,tipo_contemplacao)",
      )
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id)
      .order("data_venda", { ascending: false }),
    supabase
      .from("clientes_historico")
      .select("id,tipo_evento,descricao,created_at")
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false }),
  ]);
  const cliente = clienteResult.data as Record<string, string | null> | null;
  if (!cliente)
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-amber-900">
        Cliente não encontrado neste tenant.
      </div>
    );
  const propostas = propostasResult.data ?? [];
  const contratacoes = contratacoesResult.data ?? [];
  const vendas = vendasResult.data ?? [];
  const historico = historicoResult.data ?? [];
  return (
    <main className="space-y-6 pb-10">
      <Link
        href="/erp/clientes"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft size={17} /> Voltar para clientes
      </Link>
      <section className="rounded-3xl bg-gradient-to-br from-white to-blue-50 p-6 ring-1 ring-slate-200 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
              <UserRound size={25} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Cliente {cliente.tipo_pessoa}
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">
                {cliente.nome}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {cliente.cpf_cnpj || "Documento não informado"} ·{" "}
                {cliente.telefone || "Telefone não informado"} ·{" "}
                {cliente.email || "E-mail não informado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/erp/clientes/${id}/editar`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-blue-400"
            >
              <Pencil size={16} /> Editar cliente
            </Link>
            <Link
              href={`/erp/propostas/nova?cliente_id=${id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700"
            >
              <Plus size={16} /> Nova cota
            </Link>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Dados cadastrais">
          <Item
            label="Status"
            value={cliente.status === "ativo" ? "Ativo" : "Inativo"}
          />
          <Item
            label="Origem"
            value={
              cliente.origem === "manual"
                ? "Cadastro manual"
                : "Contratação assinada"
            }
          />
          <Item label="Responsável" value={cliente.representante_nome} />
          <Item
            label="Endereço"
            value={
              [
                cliente.endereco,
                cliente.numero,
                cliente.bairro,
                cliente.cidade,
                cliente.uf,
              ]
                .filter(Boolean)
                .join(", ") || null
            }
          />
        </Card>
        <Card title={`Cotas reais (${vendas.length})`}>
          <p className="mb-3 text-xs text-slate-500">
            Somente cotas derivadas de vendas e cotas definitivas.
          </p>
          {vendas.length ? (
            vendas.map((v: any) => (
              <div
                key={v.id}
                className="mb-2 rounded-xl bg-slate-50 p-3 text-sm"
              >
                <p className="font-bold">
                  {v.administradoras?.nome || "Administradora"} · Grupo{" "}
                  {v.grupos_consorcio?.codigo_grupo || "—"}
                </p>
                <p className="mt-1 text-slate-600">
                  Cota {v.cotas_definitivas?.[0]?.numero_cota || "em definição"}{" "}
                  · {v.cotas_definitivas?.[0]?.status || v.status}
                </p>
                {v.cotas_definitivas?.[0]?.contemplada ? (
                  <p className="mt-2 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                    CONTEMPLADA · {v.cotas_definitivas[0].tipo_contemplacao} · {new Date(`${v.cotas_definitivas[0].data_contemplacao}T12:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                ) : v.cotas_definitivas?.[0]?.id ? (
                  <CotaContemplacaoForm clienteId={id} cotaId={v.cotas_definitivas[0].id} creditoOriginal={Number(v.valor_credito)} />
                ) : null}
              </div>
            ))
          ) : (
            <Empty text="Nenhuma cota efetivada." />
          )}
        </Card>
        <Card title="Documentos">
          <p className="mb-3 text-xs text-slate-500">
            Arquivos privados das contratações do cliente.
          </p>
          {contratacoes.length ? (
            contratacoes.map((c: any) => (
              <Link
                key={c.id}
                href={`/erp/contratacoes?contratacao=${c.id}`}
                className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold hover:bg-blue-50"
              >
                <FileText size={16} className="text-blue-700" />
                {c.protocolo}
              </Link>
            ))
          ) : (
            <Empty text="Nenhum documento vinculado." />
          )}
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Propostas relacionadas">
          {propostas.length ? (
            propostas.map((p: any) => (
              <div
                key={p.id}
                className="border-b border-slate-100 py-3 last:border-0"
              >
                <p className="font-bold">
                  {p.tipo_bem || "Proposta comercial"}
                </p>
                <p className="text-sm text-slate-500">
                  {p.status} ·{" "}
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma proposta vinculada." />
          )}
        </Card>
        <Card title="Histórico">
          {historico.length ? (
            historico.map((h: any) => (
              <div
                key={h.id}
                className="border-b border-slate-100 py-3 last:border-0"
              >
                <p className="font-bold text-slate-800">{h.descricao}</p>
                <p className="text-xs text-slate-500">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))
          ) : (
            <Empty text="Sem eventos adicionais." />
          )}
          <form action={inativarClienteAction} className="pt-4">
            <input type="hidden" name="id" value={id} />
            {cliente.status === "ativo" && (
              <button className="text-xs font-bold text-slate-500 underline hover:text-red-700">
                Inativar cadastro (preserva todo o histórico)
              </button>
            )}
          </form>
        </Card>
      </section>
    </main>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-black text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">
        {value || "Não informado"}
      </p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
      {text}
    </p>
  );
}
