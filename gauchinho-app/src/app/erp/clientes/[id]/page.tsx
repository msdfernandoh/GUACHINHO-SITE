import Link from "next/link";
import { ArrowLeft, FileText, Pencil, Plus, UserRound, CheckCircle2, AlertCircle, ShieldCheck, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { inativarClienteAction, gerarCotaRealClienteAction } from "../actions";
import { CotaContemplacaoForm } from "@/components/erp/cota-contemplacao-form";
import { ClienteDocumentoBtn } from "@/components/erp/cliente-documento-btn";

const money = (v: number | string | null | undefined) => {
  const num = Number(v ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "Não informado";
  try {
    const [y, m, d] = dateStr.slice(0, 10).split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

export default async function ClienteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { sucesso_cota, erro_cota } = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();
  if (!empresaAtiva) return null;

  // 1. Busca dados do cliente no tenant
  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaAtiva.id)
    .maybeSingle();

  if (clienteError || !cliente) {
    return (
      <div className="space-y-4">
        <Link
          href="/erp/clientes"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft size={17} /> Voltar para clientes
        </Link>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
          <p className="font-bold">Cliente não encontrado neste tenant.</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Verifique se o cliente pertence à empresa selecionada.
          </p>
        </div>
      </div>
    );
  }

  // 2. Busca em paralelo das entidades relacionadas com queries simples e diretas
  const [
    participanteRes,
    propostasRes,
    contratacoesRes,
    vendasRes,
    historicoRes,
  ] = await Promise.all([
    cliente.participante_comercial_id
      ? supabase
          .from("participantes_comerciais")
          .select("id,nome,nome_exibicao")
          .eq("id", cliente.participante_comercial_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("propostas")
      .select("id,status,nome_cliente,created_at,valor_credito,valor_parcela,prazo,tipo_bem")
      .eq("cliente_id", id)
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contratacoes_online")
      .select("id,protocolo,status,contrato_assinado,contrato_assinado_em,created_at,credito_selecionado,parcela_estimada,prazo,tipo_bem,origem,grupo_nome,administradora,grupo_id,dados_simulacao,status_operacional_erp,cliente_id")
      .or(`cliente_id.eq.${id}${cliente.criado_por_contratacao_id ? `,id.eq.${cliente.criado_por_contratacao_id}` : ""}`)
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vendas")
      .select("id,data_venda,status,valor_credito,parcela,prazo,contratacao_id,administradoras(nome),grupos_consorcio(codigo_grupo)")
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

  const participante = participanteRes.data;
  const propostas = propostasRes.data ?? [];
  const rawContratacoes = (contratacoesRes.data ?? []) as any[];
  const rawVendas = (vendasRes.data ?? []) as any[];
  const historico = historicoRes.data ?? [];

  // 3. Busca documentos anexos se houver contratações
  const contratacaoIds = rawContratacoes.map((c) => c.id);
  const { data: rawDocumentos } = contratacaoIds.length
    ? await supabase
        .from("contratacoes_documentos")
        .select("id,contratacao_id,tipo_documento,arquivo_url,arquivo_nome,mime_type,created_at")
        .in("contratacao_id", contratacaoIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const documentos = (rawDocumentos ?? []) as any[];

  // 4. Busca cotas definitivas se houver vendas
  const vendaIds = rawVendas.map((v) => v.id);
  const { data: rawCotas } = vendaIds.length
    ? await supabase
        .from("cotas_definitivas")
        .select("id,venda_id,numero_cota,status,parcela,contemplada,data_contemplacao,valor_credito_contemplacao,tipo_contemplacao")
        .in("venda_id", vendaIds)
    : { data: [] };

  const cotas = (rawCotas ?? []) as any[];

  // Mapeia cotas por venda
  const cotasPorVenda = new Map<string, any>();
  for (const c of cotas) {
    cotasPorVenda.set(c.venda_id, c);
  }

  // Mapeia vendas por contratacao
  const vendasPorContratacao = new Map<string, any>();
  for (const v of rawVendas) {
    if (v.contratacao_id) {
      vendasPorContratacao.set(v.contratacao_id, {
        ...v,
        cotaDefinitiva: cotasPorVenda.get(v.id),
      });
    }
  }

  // Enriquece as contratações
  const contratacoes = rawContratacoes.map((c) => {
    const venda = vendasPorContratacao.get(c.id);
    const docs = documentos.filter((d) => d.contratacao_id === c.id);
    return {
      ...c,
      venda,
      cotaDefinitiva: venda?.cotaDefinitiva,
      documentos: docs,
    };
  });

  // Enriquece as vendas
  const vendas = rawVendas.map((v) => ({
    ...v,
    cotas_definitivas: cotasPorVenda.get(v.id) ? [cotasPorVenda.get(v.id)] : [],
  }));

  // Lista consolidada de documentos
  const todosDocumentos = documentos.map((d) => {
    const parentContratacao = rawContratacoes.find((c) => c.id === d.contratacao_id);
    return {
      ...d,
      protocoloContratacao: parentContratacao?.protocolo || "Contratação",
    };
  });

  const enderecoFormatado = [
    cliente.endereco ? `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}` : null,
    cliente.complemento || null,
    cliente.bairro ? `Bairro ${cliente.bairro}` : null,
    cliente.cidade ? `${cliente.cidade}${cliente.uf ? ` - ${cliente.uf}` : ""}` : null,
    cliente.cep ? `CEP ${cliente.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="space-y-6 pb-12 text-slate-900 dark:text-slate-100">
      {/* Botão de retorno e feedbacks */}
      <div className="flex items-center justify-between">
        <Link
          href="/erp/clientes"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft size={17} /> Voltar para clientes
        </Link>
      </div>

      {sucesso_cota && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>Cota real efetivada com sucesso no ERP! Vínculo comercial e cota definitiva gerados.</span>
        </div>
      )}

      {erro_cota && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>Erro ao efetivar cota real: {erro_cota}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO DO CLIENTE
      ───────────────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-gradient-to-br from-white to-blue-50/60 p-6 ring-1 ring-slate-200 shadow-sm dark:from-slate-900 dark:to-slate-800/80 dark:ring-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white dark:bg-blue-900">
              <UserRound size={28} />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Cliente {cliente.tipo_pessoa || "PF"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                    cliente.status === "ativo"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {cliente.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
                {cliente.origem === "contratacao_assinada" && (
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                    Origem: Contratação assinada no site
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">
                {cliente.nome}
              </h1>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <strong>CPF/CNPJ:</strong> {cliente.cpf_cnpj || "Não informado"}
                </span>
                <span>·</span>
                <span>
                  <strong>Telefone:</strong> {cliente.telefone || "Não informado"}
                </span>
                <span>·</span>
                <span>
                  <strong>E-mail:</strong> {cliente.email || "Não informado"}
                </span>
                {participante && (
                  <>
                    <span>·</span>
                    <span>
                      <strong>Responsável:</strong> {participante.nome_exibicao || participante.nome}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/erp/clientes/${id}/editar`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs hover:border-blue-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Pencil size={15} /> Editar cliente
            </Link>
            <Link
              href={`/erp/propostas/nova?cliente_id=${id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              <Plus size={16} /> Nova cota
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DADOS CADASTRAIS COMPLETOS E ENDEREÇO ESTRUTURADO
      ───────────────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Dados Pessoais & Documentação">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Nome Completo / Razão Social" value={cliente.nome} />
            <Item label="Nome Fantasia" value={cliente.nome_fantasia} />
            <Item label="CPF / CNPJ" value={cliente.cpf_cnpj} />
            <Item
              label="RG / Documento"
              value={cliente.rg ? `${cliente.rg}${cliente.orgao_emissor ? ` (${cliente.orgao_emissor})` : ""}` : null}
            />
            <Item label="Data de Nascimento" value={formatDate(cliente.data_nascimento)} />
            <Item label="Estado Civil" value={cliente.estado_civil} />
            <Item label="Profissão" value={cliente.profissao} />
            <Item label="Representante / Responsável" value={cliente.representante_nome} />
            <Item label="Telefone Principal" value={cliente.telefone} />
            <Item label="Telefone Secundário / WhatsApp" value={cliente.telefone_secundario} />
            <Item label="E-mail" value={cliente.email} />
            <Item
              label="Origem do Cadastro"
              value={cliente.origem === "manual" ? "Cadastro manual no ERP" : "Contratação assinada no site"}
            />
          </div>
          {cliente.observacoes && (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Observações</p>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{cliente.observacoes}</p>
            </div>
          )}
        </Card>

        <Card title="Endereço Estruturado">
          {enderecoFormatado ? (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs font-semibold text-blue-950 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200 flex items-start gap-2">
              <MapPin size={16} className="shrink-0 text-blue-600 mt-0.5" />
              <span>{enderecoFormatado}</span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Item label="CEP" value={cliente.cep} />
            <div className="sm:col-span-2">
              <Item label="Logradouro / Endereço" value={cliente.endereco} />
            </div>
            <Item label="Número" value={cliente.numero} />
            <Item label="Complemento" value={cliente.complemento} />
            <Item label="Bairro" value={cliente.bairro} />
            <Item label="Cidade" value={cliente.cidade} />
            <Item label="Estado (UF)" value={cliente.uf} />
            <Item label="Status do Cadastro" value={cliente.status === "ativo" ? "Ativo" : "Inativo"} />
          </div>
        </Card>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          COTAS CONTRATADAS / AGUARDANDO EFETIVAÇÃO (FLUXO DO SITE)
      ───────────────────────────────────────────────────────────── */}
      <Card title={`Cotas Contratadas no Site / Aguardando Efetivação (${contratacoes.length})`}>
        <p className="mb-3 text-xs text-slate-500">
          Contratações originadas no site pelo Simulador ou Catálogo de Grupos com snapshot comercial preservado.
        </p>

        {contratacoes.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Protocolo</th>
                  <th className="p-3">Administradora</th>
                  <th className="p-3">Grupo</th>
                  <th className="p-3 text-right">Crédito</th>
                  <th className="p-3 text-right">Parcela</th>
                  <th className="p-3">Modalidade</th>
                  <th className="p-3 text-center">Prazo</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Origem</th>
                  <th className="p-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contratacoes.map((c) => {
                  const modalidade =
                    c.dados_simulacao?.modalidade ||
                    c.dados_simulacao?.plano ||
                    c.tipo_bem ||
                    "Padrão";
                  const isEfetivada = Boolean(c.cotaDefinitiva?.id);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                        {c.protocolo}
                      </td>
                      <td className="p-3 font-semibold">{c.administradora || "—"}</td>
                      <td className="p-3 font-mono">{c.grupo_nome || "—"}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {money(c.credito_selecionado || c.dados_simulacao?.valor_credito)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {money(c.parcela_estimada || c.dados_simulacao?.valor_parcela)}
                      </td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {modalidade}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {c.prazo || c.dados_simulacao?.prazo || "—"}m
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            isEfetivada
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : c.contrato_assinado
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {isEfetivada
                            ? "Cota Efetivada"
                            : c.contrato_assinado
                            ? "Contratada (Assinada)"
                            : c.status}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {c.origem === "grupos" ? "Site (Grupos)" : "Site (Simulador)"}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {isEfetivada ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <ShieldCheck size={14} /> Cota #{c.cotaDefinitiva?.numero_cota || "Definida"}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <form action={gerarCotaRealClienteAction}>
                              <input type="hidden" name="contratacao_id" value={c.id} />
                              <input type="hidden" name="cliente_id" value={id} />
                              <button
                                type="submit"
                                className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                              >
                                Gerar cota real
                              </button>
                            </form>
                            <Link
                              href={`/erp/contratacoes/${c.id}`}
                              className="rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                              Conferir
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Nenhuma contratação originada no site encontrada para este cliente." />
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          COTAS REAIS DEFINITIVAS & DOCUMENTOS
      ───────────────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title={`Cotas Reais Efetivadas (${vendas.length})`}>
          <p className="mb-3 text-xs text-slate-500">
            Cotas consolidadas no ERP vinculadas às administradoras e regras de contemplação.
          </p>

          {vendas.length ? (
            vendas.map((v: any) => {
              const cota = Array.isArray(v.cotas_definitivas) ? v.cotas_definitivas[0] : v.cotas_definitivas;
              return (
                <div
                  key={v.id}
                  className="mb-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {v.administradoras?.nome || "Administradora"} · Grupo{" "}
                        <span className="font-mono">{v.grupos_consorcio?.codigo_grupo || "—"}</span>
                      </p>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                        Cota <strong className="font-mono">{cota?.numero_cota || "em definição"}</strong> · Crédito:{" "}
                        <strong>{money(v.valor_credito)}</strong> · Parcela: {money(v.parcela)} ({v.prazo}m)
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {cota?.status || v.status}
                    </span>
                  </div>

                  {cota?.contemplada ? (
                    <p className="mt-2 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      CONTEMPLADA · {cota.tipo_contemplacao || "Sorteio"} · {formatDate(cota.data_contemplacao)}
                    </p>
                  ) : cota?.id ? (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                      <CotaContemplacaoForm
                        clienteId={id}
                        cotaId={cota.id}
                        creditoOriginal={Number(v.valor_credito)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <Empty text="Nenhuma cota definitiva efetivada no ERP." />
          )}
        </Card>

        <Card title={`Documentos do Cliente (${todosDocumentos.length + contratacoes.filter((c) => c.contrato_assinado).length})`}>
          <p className="mb-3 text-xs text-slate-500">
            Contratos assinados e arquivos enviados durante o processo de contratação.
          </p>

          <div className="space-y-2">
            {/* Contratos assinados */}
            {contratacoes
              .filter((c) => c.contrato_assinado)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs dark:border-blue-900/30 dark:bg-blue-950/20"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-700 dark:text-blue-400" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Contrato Assinado ({c.protocolo})
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Assinado em: {formatDate(c.contrato_assinado_em)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/erp/contratacoes/${c.id}`}
                    className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300"
                  >
                    Abrir Contratação
                  </Link>
                </div>
              ))}

            {/* Documentos anexos */}
            {todosDocumentos.length ? (
              todosDocumentos.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText size={16} className="shrink-0 text-slate-500" />
                    <div className="truncate">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {doc.tipo_documento?.replace(/_/g, " ").toUpperCase() || "DOCUMENTO"}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate font-mono">
                        {doc.arquivo_nome || "Arquivo anexo"} · {doc.protocoloContratacao}
                      </p>
                    </div>
                  </div>
                  <ClienteDocumentoBtn arquivoUrl={doc.arquivo_url} arquivoNome={doc.arquivo_nome} />
                </div>
              ))
            ) : null}

            {!contratacoes.some((c) => c.contrato_assinado) && todosDocumentos.length === 0 && (
              <Empty text="Nenhum documento ou contrato vinculado." />
            )}
          </div>
        </Card>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PROPOSTAS RELACIONADAS & HISTÓRICO
      ───────────────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title={`Propostas Relacionadas (${propostas.length})`}>
          {propostas.length ? (
            propostas.map((p: any) => (
              <div
                key={p.id}
                className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {p.tipo_bem || "Proposta Comercial"}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Crédito: <strong>{money(p.valor_credito)}</strong> · Parcela: {money(p.valor_parcela)} ·{" "}
                    {formatDate(p.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {p.status}
                </span>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma proposta comercial vinculada." />
          )}
        </Card>

        <Card title="Linha do Tempo & Histórico">
          {historico.length ? (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {historico.map((h: any) => (
                <div
                  key={h.id}
                  className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800 text-xs"
                >
                  <p className="font-bold text-slate-800 dark:text-slate-200">{h.descricao}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Sem eventos adicionais." />
          )}

          <form action={inativarClienteAction} className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <input type="hidden" name="id" value={id} />
            {cliente.status === "ativo" && (
              <button
                type="submit"
                className="text-xs font-bold text-slate-500 underline hover:text-red-700 transition"
              >
                Inativar cadastro do cliente (preserva todo o histórico)
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-base font-black text-slate-900 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
        {value || "Não informado"}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">
      {text}
    </p>
  );
}
