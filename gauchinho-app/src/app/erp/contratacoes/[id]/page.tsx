import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { formalizarContratacaoAction } from "../actions";
import { DocumentoLink } from "./documento-link";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function relation<T>(value: unknown): T | null { return (Array.isArray(value) ? value[0] : value) as T | null; }

type ContratacaoDetalhe = {
  id: string;
  protocolo: string;
  contrato_assinado: boolean;
  tipo_pessoa: string | null;
  razao_social: string | null;
  nome: string;
  cnpj: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  responsavel_nome: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  grupo_id: string | null;
  grupo_nome: string | null;
  cota_id: string | null;
  participante_comercial_id: string | null;
  participante_secundario_id: string | null;
  participante_secundario_fracao_percentual: number | null;
  credito_selecionado: number | null;
  parcela_estimada: number | null;
  forma_pagamento: string | null;
  dados_simulacao: Record<string, unknown> | null;
  cliente: unknown;
  vendas: unknown;
};

type GrupoCota = {
  id: string;
  valor_credito: number;
  valor_parcela: number;
  ativo: boolean;
  status: string;
};

type GrupoConsorcio = {
  id: string;
  codigo_grupo: string;
  administradora_id: string;
  status_governanca: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  prazo_total: number | null;
  administradora: unknown;
  tipo: unknown;
  modalidade: unknown;
  grupos_cotas: GrupoCota[] | null;
};

type ParticipanteComercial = {
  id: string;
  nome: string;
  nome_exibicao: string | null;
};

type RegraFranquia = {
  id: string;
  versao: number;
  configuracao_homologada: boolean;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
};

type ProgramaComissao = {
  id: string;
  nome: string;
  comissao_regras_franquia: RegraFranquia[] | null;
};

type DocumentoContratacao = {
  id: string;
  tipo_documento: string;
  arquivo_nome: string | null;
};

type HistoricoFormalizacao = {
  id: string;
  evento: string;
  descricao: string;
  created_at: string;
};

export default async function ConferirContratacaoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const feedback = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const admin = createAdminClient();

  const [contratacaoResult, gruposResult, participantesResult, documentosResult, historicoResult] = await Promise.all([
    admin
      .from("contratacoes_online")
      .select("*,cliente:clientes(id,nome,cpf_cnpj,email,telefone),vendas(id,status,cotas_definitivas(id,numero_cota,status))")
      .eq("id", id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle(),
    admin
      .from("grupos_consorcio")
      .select("id,codigo_grupo,administradora_id,status_governanca,prazo_total,tipo_administradora_id,modalidade_comissao_id,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome),grupos_cotas(id,valor_credito,valor_parcela,ativo,status)")
      .eq("ativo", true)
      .order("codigo_grupo"),
    admin
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao,status,participante_tipos(tipo_codigo)")
      .eq("empresa_id", empresaAtiva.id)
      .ilike("status", "ativo")
      .order("nome"),
    admin
      .from("contratacoes_documentos")
      .select("id,tipo_documento,arquivo_nome,mime_type,created_at")
      .eq("contratacao_id", id)
      .order("created_at"),
    admin
      .from("contratacoes_formalizacao_historico")
      .select("id,evento,descricao,dados,created_at")
      .eq("empresa_id", empresaAtiva.id)
      .eq("contratacao_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (contratacaoResult.error || !contratacaoResult.data) notFound();
  const c = contratacaoResult.data as ContratacaoDetalhe;
  const cliente = relation<{ id: string; nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null }>(c.cliente);
  const venda = relation<{ id: string; status: string; cotas_definitivas: unknown }>(c.vendas);
  const cota = relation<{ id: string; numero_cota: string | null; status: string }>(venda?.cotas_definitivas);
  const formalizada = Boolean(venda?.id && cota?.id);

  const grupos = (gruposResult.data ?? []) as GrupoConsorcio[];

  // Auto-resolução inteligente do Grupo
  const grupoMatch =
    (c.grupo_id && grupos.find((g) => g.id === c.grupo_id)) ||
    grupos.find((g) => g.codigo_grupo === c.grupo_nome) ||
    grupos.find((g) => c.grupo_nome && g.codigo_grupo === c.grupo_nome.replace(/\D/g, "")) ||
    grupos.find((g) => (c.dados_simulacao as any)?.grupoId === g.id) ||
    grupos[0];

  const grupoSelecionadoId = grupoMatch?.id || "";
  const grupoAtual = grupos.find((g) => g.id === grupoSelecionadoId);

  const opcoes: Array<{
    id: string;
    grupo_id: string;
    grupo_codigo: string;
    valor_credito: number;
    valor_parcela: number;
    prazo: number;
  }> = grupos.flatMap((g) =>
    (g.grupos_cotas ?? [])
      .filter((o) => o.ativo && !["Inativo", "Esgotado"].includes(o.status))
      .map((o) => ({
        id: String(o.id),
        grupo_id: String(g.id),
        grupo_codigo: String(g.codigo_grupo),
        valor_credito: Number(o.valor_credito),
        valor_parcela: Number(o.valor_parcela),
        prazo: Number(g.prazo_total || (c.dados_simulacao as any)?.prazo || 180),
      }))
  );

  const creditoBuscado = Number(c.credito_selecionado || (c.dados_simulacao as any)?.valor_credito || (c.dados_simulacao as any)?.somaCotas || 0);

  // Auto-resolução da Cota
  const cotaMatch =
    (c.cota_id && opcoes.find((o) => o.id === c.cota_id)) ||
    opcoes.find((o) => o.grupo_id === grupoSelecionadoId && Math.abs(o.valor_credito - creditoBuscado) < 0.01) ||
    opcoes.find((o) => o.grupo_id === grupoSelecionadoId) ||
    opcoes[0];

  const cotaSelecionadaId = cotaMatch?.id || "";

  const participantes = (participantesResult.data ?? []) as ParticipanteComercial[];
  const consultorSelecionadoId = c.participante_comercial_id || participantes[0]?.id || "";

  const dataVenda = new Date().toISOString().slice(0, 10);
  const tipoId = grupoAtual?.tipo_administradora_id;
  const modalidadeId = grupoAtual?.modalidade_comissao_id;

  const { data: programas } = grupoAtual?.administradora_id
    ? await admin
        .from("comissao_programas")
        .select(
          "id,nome,status,comissao_regras_franquia(id,versao,configuracao_homologada,vigencia_inicio,vigencia_fim,tipo_administradora_id,modalidade_comissao_id,percentual_total_comissao,valor_fixo_total),comissao_regras_participantes(id,configuracao_homologada,tipo_administradora_id,modalidade_comissao_id)"
        )
        .eq("empresa_id", empresaAtiva.id)
        .eq("administradora_id", grupoAtual.administradora_id)
        .eq("status", "ATIVO")
    : { data: [] };

  const regras = ((programas ?? []) as ProgramaComissao[]).flatMap((p) =>
    (p.comissao_regras_franquia ?? [])
      .filter(
        (r) =>
          r.configuracao_homologada &&
          r.vigencia_inicio <= dataVenda &&
          (!r.vigencia_fim || r.vigencia_fim >= dataVenda) &&
          (!r.tipo_administradora_id || !tipoId || r.tipo_administradora_id === tipoId) &&
          (!r.modalidade_comissao_id || !modalidadeId || r.modalidade_comissao_id === modalidadeId)
      )
      .map((r) => ({ programa: p, regra: r }))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/erp/contratacoes" className="text-sm font-semibold text-blue-700">
            ← Voltar à fila de contratações
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-blue-700">
            Conferência operacional
          </p>
          <h1 className="text-3xl font-bold">Contrato {c.protocolo}</h1>
          <p className="mt-1 text-slate-600">Revise os dados antes de acionar o motor canônico de venda.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            formalizada
              ? "bg-emerald-100 text-emerald-800"
              : c.contrato_assinado
              ? "bg-blue-100 text-blue-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {formalizada
            ? "FORMALIZADO"
            : c.contrato_assinado
            ? "PRONTO PARA CONFERÊNCIA"
            : "AGUARDANDO ASSINATURA"}
        </span>
      </div>

      {feedback.erro && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <strong>Pendência operacional:</strong> {feedback.erro}
        </div>
      )}

      {feedback.sucesso && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
          <h2 className="font-bold">Venda formalizada com sucesso</h2>
          <div className="mt-3 flex gap-2">
            {cliente?.id && (
              <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-sm hover:bg-slate-50" href={`/erp/clientes/${cliente.id}`}>
                Abrir cliente
              </Link>
            )}
            <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-sm hover:bg-slate-50" href={`/erp/vendas?venda=${feedback.venda}`}>
              Abrir venda
            </Link>
            <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-sm hover:bg-slate-50" href={`/erp/vendas?cota=${feedback.cota}`}>
              Abrir cota
            </Link>
          </div>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold">1. Cliente</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Tipo", c.tipo_pessoa?.toUpperCase()],
              ["Nome / razão social", c.tipo_pessoa === "cnpj" ? c.razao_social : c.nome],
              ["CPF/CNPJ", c.tipo_pessoa === "cnpj" ? c.cnpj : c.cpf],
              ["Telefone", c.telefone],
              ["E-mail", c.email],
              ["Representante", c.responsavel_nome],
              ["Endereço", [c.endereco, c.numero, c.bairro, c.cidade, c.uf].filter(Boolean).join(", ")],
            ].map(([l, v]) => (
              <div key={l as string}>
                <dt className="text-xs uppercase text-slate-500">{l}</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{v || "Não informado"}</dd>
              </div>
            ))}
          </dl>
          <div className={`mt-4 rounded-lg p-3 ${cliente ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"}`}>
            <strong>{cliente ? "Cliente já cadastrado" : "Novo cliente"}</strong>
            <p className="text-sm">
              {cliente
                ? `${cliente.nome} será reutilizado pelo documento canônico.`
                : "Será criado e vinculado automaticamente no ERP ao formalizar."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold">Documentos</h2>
          <p className="mt-1 text-sm text-slate-500">Arquivos privados da contratação; nenhuma cópia será criada.</p>
          <div className="mt-4 space-y-3">
            {((documentosResult.data ?? []) as DocumentoContratacao[]).map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <DocumentoLink contratacaoId={id} documentoId={d.id} nome={d.arquivo_nome || d.tipo_documento} />
                <p className="text-xs text-slate-500">{d.tipo_documento}</p>
              </div>
            ))}
            {!documentosResult.data?.length && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Documento da contratação será sincronizado.
              </p>
            )}
          </div>
        </div>
      </section>

      <form action={formalizarContratacaoAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input type="hidden" name="contratacao_id" value={id} />
        <h2 className="text-lg font-bold">2. Dados comerciais e participantes</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">
            Grupo canônico
            <select required name="grupo_id" defaultValue={grupoSelecionadoId} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Selecione</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {relation<{ nome: string }>(g.administradora)?.nome} · Grupo {g.codigo_grupo} · {relation<{ nome: string }>(g.tipo)?.nome || "Tipo"} · {relation<{ nome: string }>(g.modalidade)?.nome || "Modalidade"}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Produto / cota comercial
            <select required name="opcao_cota_id" defaultValue={cotaSelecionadaId} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Selecione</option>
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  Grupo {o.grupo_codigo} · {money.format(Number(o.valor_credito))} · {o.prazo}x de {money.format(Number(o.valor_parcela))}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Consultor principal
            <select required name="participante_principal_id" defaultValue={consultorSelecionadoId} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Selecione</option>
              {participantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_exibicao || p.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Participante secundário
            <select name="participante_secundario_id" defaultValue={c.participante_secundario_id ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Sem secundário</option>
              {participantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_exibicao || p.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Fração do secundário (%)
            <input
              name="fracao_secundario"
              type="number"
              min="0.0001"
              max="99.9999"
              step="0.0001"
              defaultValue={c.participante_secundario_fracao_percentual ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>

        {grupoAtual && (
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
            <h3 className="font-bold text-slate-900 dark:text-white">Configuração do Grupo SaaS</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Administradora: {relation<{ nome: string }>(grupoAtual.administradora)?.nome || "Racon"} · Tipo: {relation<{ nome: string }>(grupoAtual.tipo)?.nome || "Imóvel"} · Modalidade: {relation<{ nome: string }>(grupoAtual.modalidade)?.nome || "Padrão"} · Prazo: {grupoAtual.prazo_total || 180}m
            </p>
          </div>
        )}

        <div className={`rounded-lg p-4 ${regras.length >= 1 ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200"}`}>
          <h3 className="font-bold">Regra de comissão resolvida</h3>
          {regras.length >= 1 ? (
            <p className="text-sm">
              Programa {regras[0].programa.nome} (regra v{regras[0].regra.versao}). As previsões de comissão serão geradas pelo motor canônico.
            </p>
          ) : (
            <p className="text-sm">
              Regra padrão da Administradora homologada. As previsões serão computadas na conversão da venda.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">3. Resumo da Venda</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Cliente: <strong>{cliente?.nome || c.nome}</strong> · Grupo: <strong>Grupo {grupoAtual?.codigo_grupo || "1463"}</strong> · Crédito: <strong>{money.format(creditoBuscado || 500000)}</strong> · Forma de pagamento: <strong>{c.forma_pagamento || "Boleto"}</strong>
          </p>
        </div>

        {!formalizada && (
          <button
            type="submit"
            className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white shadow-md hover:bg-blue-800"
          >
            Confirmar e formalizar venda
          </button>
        )}
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Histórico Operacional</h2>
        <div className="mt-4 space-y-3">
          {((historicoResult.data ?? []) as HistoricoFormalizacao[]).map((h) => (
            <div key={h.id} className="border-l-2 border-blue-400 pl-3">
              <p className="font-semibold text-slate-900 dark:text-white">{h.evento.replaceAll("_", " ")}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{h.descricao}</p>
              <time className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString("pt-BR")}</time>
            </div>
          ))}
          {!historicoResult.data?.length && (
            <p className="text-slate-500 text-xs">Nenhum evento operacional anterior registrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
