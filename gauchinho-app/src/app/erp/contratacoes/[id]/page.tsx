import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { calcularPrazoGrupoFromRow } from "@/lib/grupos/prazos";
import { formalizarContratacaoAction } from "../actions";
import { DocumentoLink } from "./documento-link";
import {
  FormalizacaoCatalogoFields,
  type FormalizacaoCatalogoGrupo,
} from "./formalizacao-catalogo-fields";

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
  parcelas_realizadas: number | null;
  prazo_restante: number | null;
  parcelas_realizadas_base: number | null;
  data_base_parcelas: string | null;
  atualizacao_parcelas_automatica: boolean;
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

  const [{ data: concessoes }, { data: configuracoesGrupo }] = await Promise.all([
    admin
      .from("empresa_administradoras")
      .select("administradora_id")
      .eq("empresa_id", empresaAtiva.id)
      .eq("status", "ATIVA"),
    admin
      .from("empresa_grupos_config")
      .select("grupo_id,visivel")
      .eq("empresa_id", empresaAtiva.id),
  ]);
  const administradorasPermitidas = (concessoes ?? []).map((item) => item.administradora_id);
  const gruposOcultos = new Set(
    (configuracoesGrupo ?? []).filter((item) => !item.visivel).map((item) => item.grupo_id),
  );
  const gruposQuery = admin
    .from("grupos_consorcio")
    .select("id,codigo_grupo,administradora_id,status_governanca,prazo_total,parcelas_realizadas,prazo_restante,parcelas_realizadas_base,data_base_parcelas,atualizacao_parcelas_automatica,tipo_administradora_id,modalidade_comissao_id,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome),grupos_cotas(id,valor_credito,ativo,status)")
    .eq("ativo", true)
    .in("administradora_id", administradorasPermitidas.length ? administradorasPermitidas : ["00000000-0000-0000-0000-000000000000"])
    .order("codigo_grupo");

  const [contratacaoResult, gruposResult, participantesResult, documentosResult, historicoResult] = await Promise.all([
    admin
      .from("contratacoes_online")
      .select("*,cliente:clientes(id,nome,cpf_cnpj,email,telefone),vendas(id,status,cotas_definitivas(id,numero_cota,status))")
      .eq("id", id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle(),
    gruposQuery,
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

  const grupos = ((gruposResult.data ?? []) as GrupoConsorcio[]).filter(
    (grupo) => !gruposOcultos.has(grupo.id),
  );

  const grupoIds = grupos.map((grupo) => grupo.id);
  const cotaIds = grupos.flatMap((grupo) => (grupo.grupos_cotas ?? []).map((cota) => cota.id));
  const [{ data: modalidadesDisponiveis }, { data: valoresModalidade }] = await Promise.all([
    admin
      .from("grupos_modalidades_disponiveis")
      .select("grupo_id,administradora_modalidade_id,ativo,modalidade:administradora_modalidades_comissao(id,codigo,nome,ativo)")
      .in("grupo_id", grupoIds.length ? grupoIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("ativo", true),
    admin
      .from("grupo_cota_modalidade_valores")
      .select("grupo_cota_id,administradora_modalidade_id,valor_parcela,percentual_reducao,habilitado,ativo")
      .in("grupo_cota_id", cotaIds.length ? cotaIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("ativo", true),
  ]);

  const catalogoGrupos: FormalizacaoCatalogoGrupo[] = grupos.map((grupo) => {
    const prazo = calcularPrazoGrupoFromRow(grupo);
    return {
      id: grupo.id,
      codigo: grupo.codigo_grupo,
      administradora: relation<{ nome: string }>(grupo.administradora)?.nome ?? "Administradora",
      tipo: relation<{ nome: string }>(grupo.tipo)?.nome ?? "Tipo não configurado",
      prazoOriginal: prazo.prazoTotal,
      parcelasRestantes: prazo.prazoRestanteAtual,
      produtos: (grupo.grupos_cotas ?? [])
      .filter((cota) => cota.ativo && !["Inativo", "Esgotado"].includes(cota.status))
      .map((cota) => ({
        id: cota.id,
        valorCredito: Number(cota.valor_credito),
        modalidades: (modalidadesDisponiveis ?? []).flatMap((disponibilidade) => {
          if (disponibilidade.grupo_id !== grupo.id) return [];
          const modalidade = relation<{ id: string; codigo: string; nome: string; ativo: boolean }>(disponibilidade.modalidade);
          const valor = (valoresModalidade ?? []).find(
            (item) =>
              item.grupo_cota_id === cota.id &&
              item.administradora_modalidade_id === disponibilidade.administradora_modalidade_id,
          );
          return modalidade?.ativo && valor?.habilitado
            ? [{
                id: modalidade.id,
                codigo: modalidade.codigo,
                nome: modalidade.nome,
                valorParcela: Number(valor.valor_parcela),
                percentualReducao: valor.percentual_reducao == null ? null : Number(valor.percentual_reducao),
              }]
            : [];
        }),
      }))
      .filter((produto) => produto.modalidades.length > 0),
    };
  }).filter((grupo) => grupo.parcelasRestantes > 0 && grupo.produtos.length > 0);

  // Pré-seleção somente por UUID canônico já persistido; nunca por nome/valor aproximado.
  const grupoMatch = c.grupo_id ? grupos.find((g) => g.id === c.grupo_id) : undefined;

  const grupoSelecionadoId = grupoMatch?.id || "";

  const opcoes: Array<{
    id: string;
    grupo_id: string;
    grupo_codigo: string;
    valor_credito: number;
  }> = grupos.flatMap((g) =>
    (g.grupos_cotas ?? [])
      .filter((o) => o.ativo && !["Inativo", "Esgotado"].includes(o.status))
      .map((o) => ({
        id: String(o.id),
        grupo_id: String(g.id),
        grupo_codigo: String(g.codigo_grupo),
        valor_credito: Number(o.valor_credito),
      }))
  );

  const cotaMatch = c.cota_id
    ? opcoes.find((o) => o.id === c.cota_id && o.grupo_id === grupoSelecionadoId)
    : undefined;

  const cotaSelecionadaId = cotaMatch?.id || "";
  const modalidadeSelecionadaId =
    String((c.dados_simulacao as Record<string, unknown> | null)?.modalidade_comissao_id ?? "") ||
    "";

  const participantes = (participantesResult.data ?? []) as ParticipanteComercial[];
  const consultorSelecionadoId = c.participante_comercial_id || participantes[0]?.id || "";

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
        <FormalizacaoCatalogoFields
          grupos={catalogoGrupos}
          initialGrupoId={grupoSelecionadoId}
          initialProdutoId={cotaSelecionadaId}
          initialModalidadeId={modalidadeSelecionadaId}
        />

        <div className="grid gap-4 md:grid-cols-3">
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

        <div className="rounded-lg bg-blue-50 p-4 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200">
          <h3 className="font-bold">Validação da comissão</h3>
          <p className="text-sm">
            Ao confirmar, o banco exigirá exatamente uma regra homologada para a empresa,
            administradora, tipo e UUID da modalidade escolhida. Nenhum percentual será inferido pelo nome.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">3. Cliente e pagamento</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Cliente: <strong>{cliente?.nome || c.nome}</strong> · Forma de pagamento: <strong>{c.forma_pagamento || "Boleto"}</strong>
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
