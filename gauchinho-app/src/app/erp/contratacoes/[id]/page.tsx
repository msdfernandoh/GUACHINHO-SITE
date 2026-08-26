import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantPermission } from "@/lib/tenant/context";
import { calcularPrazoGrupoFromRow } from "@/lib/grupos/prazos";
import { DocumentoLink } from "./documento-link";
import {
  FormalizacaoVendaForm,
  type GrupoConsorcio,
  type ParticipanteComercial,
  type VinculoPerfil,
  type RegraParticipante,
} from "@/components/erp/contratacoes/formalizacao-venda-form";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const feedback = await searchParams;
  const { empresaAtiva } = await requireTenantPermission("formalizar_vendas");
  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: administradorasEmpresa }, { data: configuracoesGrupos }] = await Promise.all([
    admin
      .from("empresa_administradoras")
      .select("administradora_id")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativo", true),
    admin
      .from("empresa_grupos_config")
      .select("grupo_id,visivel")
      .eq("empresa_id", empresaAtiva.id),
  ]);
  const administradorasPermitidas = (administradorasEmpresa ?? []).map((item) => item.administradora_id);
  const gruposOcultos = new Set(
    (configuracoesGrupos ?? []).filter((item) => item.visivel === false).map((item) => item.grupo_id),
  );

  const [
    contratacaoResult,
    gruposResult,
    participantesResult,
    vinculosResult,
    regrasParticipantesResult,
    documentosResult,
    historicoResult,
    regrasFranquiaResult,
  ] = await Promise.all([
    admin
      .from("contratacoes_online")
      .select("*,cliente:clientes(id,nome,cpf_cnpj,email,telefone),vendas(id,status,cotas_definitivas(id,numero_cota,status))")
      .eq("id", id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle(),
    admin
      .from("grupos_consorcio")
      .select("id,codigo_grupo,administradora_id,status_governanca,prazo_total,prazo_restante,parcelas_realizadas,parcelas_realizadas_base,data_base_parcelas,atualizacao_parcelas_automatica,tipo_administradora_id,modalidade_comissao_id,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome),grupos_modalidades_disponiveis(administradora_modalidade_id,ativo),grupos_cotas(id,valor_credito,ativo,status,grupo_cota_modalidade_valores(administradora_modalidade_id,valor_parcela,percentual_reducao,habilitado,ativo,modalidade:administradora_modalidades_comissao(id,codigo,nome,ativo)))")
      .eq("ativo", true)
      .in("administradora_id", administradorasPermitidas.length ? administradorasPermitidas : ["00000000-0000-0000-0000-000000000000"])
      .order("codigo_grupo"),
    admin
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao,status,participante_tipos(tipo_codigo)")
      .eq("empresa_id", empresaAtiva.id)
      .ilike("status", "ativo")
      .order("nome"),
    admin
      .from("participante_comissao_perfis")
      .select("id,participante_id,papel_tipo,perfil_id,override_percentual,perfil:comissao_perfis(id,nome,papel_base)")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativo", true)
      .lte("vigencia_inicio", hoje)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`),
    admin
      .from("comissao_regras_participantes")
      .select("id,perfil_id,programa_id,percentual_comissao,seguir_cronograma_franquia,etapas_cronograma,base_v2,status,versao")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativa", true)
      .eq("configuracao_homologada", true)
      .eq("status", "HOMOLOGADA")
      .lte("vigencia_inicio", hoje)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)
      .order("versao", { ascending: false }),
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
    admin
      .from("comissao_regras_franquia")
      .select("id,programa_id,percentual_total_comissao,tipo_administradora_id,modalidade_comissao_id,ativa,configuracao_homologada,etapas_cronograma,comissao_regra_etapas(id,ordem,percentual_venda,nome,tipo_gatilho)")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativa", true)
      .eq("configuracao_homologada", true)
      .lte("vigencia_inicio", hoje)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`),
  ]);

  if (contratacaoResult.error || !contratacaoResult.data) notFound();
  const c = contratacaoResult.data as ContratacaoDetalhe;
  const cliente = relation<{ id: string; nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null }>(c.cliente);
  const venda = relation<{ id: string; status: string; cotas_definitivas: unknown }>(c.vendas);
  const cota = relation<{ id: string; numero_cota: string | null; status: string }>(venda?.cotas_definitivas);
  const formalizada = Boolean(venda?.id && cota?.id);

  const grupos = ((gruposResult.data ?? []) as Array<Record<string, any>>)
    .filter((grupo) => !gruposOcultos.has(String(grupo.id)))
    .map((grupo) => {
      const prazo = calcularPrazoGrupoFromRow(grupo as any);
      const modalidadesAtivas = new Set(
        ((grupo.grupos_modalidades_disponiveis ?? []) as Array<Record<string, any>>)
          .filter((item) => item.ativo !== false)
          .map((item) => String(item.administradora_modalidade_id)),
      );
      const gruposCotas = ((grupo.grupos_cotas ?? []) as Array<Record<string, any>>)
        .filter((produto) => produto.ativo !== false && !["inativo", "esgotado"].includes(String(produto.status ?? "").toLowerCase()))
        .map((produto) => ({
          id: String(produto.id),
          valor_credito: Number(produto.valor_credito),
          ativo: produto.ativo !== false,
          status: produto.status == null ? undefined : String(produto.status),
          grupo_codigo: String(grupo.codigo_grupo),
          modalidades: ((produto.grupo_cota_modalidade_valores ?? []) as Array<Record<string, any>>)
            .filter((valor) => valor.ativo !== false && valor.habilitado !== false && modalidadesAtivas.has(String(valor.administradora_modalidade_id)))
            .map((valor) => {
              const modalidade = relation<{ id: string; codigo: string; nome: string; ativo: boolean }>(valor.modalidade);
              if (!modalidade?.id || modalidade.ativo === false) return null;
              return {
                id: modalidade.id,
                codigo: modalidade.codigo,
                nome: modalidade.nome,
                valor_parcela: Number(valor.valor_parcela),
                percentual_reducao: valor.percentual_reducao == null ? null : Number(valor.percentual_reducao),
              };
            })
            .filter((modalidade): modalidade is NonNullable<typeof modalidade> => modalidade !== null),
        }))
        .filter((produto) => produto.modalidades.length > 0);

      return {
        ...grupo,
        prazo_total: prazo.prazoTotal,
        prazo_restante: prazo.prazoRestanteAtual,
        parcelas_realizadas: prazo.parcelasRealizadasAtuais,
        atualizacao_parcelas_automatica: prazo.modoAutomatico,
        grupos_cotas: gruposCotas,
      } as GrupoConsorcio;
    })
    .filter((grupo) => grupo.prazo_restante > 0 && (grupo.grupos_cotas?.length ?? 0) > 0);
  const participantes = (participantesResult.data ?? []) as ParticipanteComercial[];
  const vinculosPerfis = ((vinculosResult.data ?? []) as unknown) as VinculoPerfil[];
  const regrasParticipantes = ((regrasParticipantesResult.data ?? []) as unknown) as RegraParticipante[];

  // Pré-seleção somente por UUID canônico persistido. Nunca escolhe o primeiro item por aproximação.
  const grupoMatch = c.grupo_id ? grupos.find((grupo) => grupo.id === c.grupo_id) : undefined;

  const grupoSelecionadoId = grupoMatch?.id || "";

  const cotaMatch = c.cota_id
    ? (grupoMatch?.grupos_cotas ?? []).find((produto) => produto.id === c.cota_id)
    : undefined;

  const cotaSelecionadaId = cotaMatch?.id || "";
  const modalidadePersistidaId = String((c.dados_simulacao as any)?.modalidade_comissao_id ?? "");
  const modalidadeSelecionadaId = cotaMatch?.modalidades.some((item) => item.id === modalidadePersistidaId)
    ? modalidadePersistidaId
    : "";

  const consultorSelecionadoId =
    c.participante_comercial_id && participantes.some((participante) => participante.id === c.participante_comercial_id)
      ? c.participante_comercial_id
      : "";

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/erp/contratacoes" className="text-xs font-semibold text-blue-700 hover:underline">
            ← Voltar para contratações
          </Link>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            Conferência e Formalização da Contratação
          </h1>
          <p className="text-xs text-slate-500">Conferência operacional · Regra de comissão resolvida · Protocolo {c.protocolo}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
            formalizada
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : c.contrato_assinado
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {formalizada
            ? "VENDA FORMALIZADA"
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
              <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-xs hover:bg-slate-50" href={`/erp/clientes/${cliente.id}`}>
                Abrir cliente
              </Link>
            )}
            <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-xs hover:bg-slate-50" href={`/erp/vendas?venda=${feedback.venda}`}>
              Abrir venda
            </Link>
            <Link className="rounded-lg bg-white px-3 py-2 font-semibold shadow-xs hover:bg-slate-50" href={`/erp/vendas?cota=${feedback.cota}`}>
              Abrir cota
            </Link>
          </div>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
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

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
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

      {/* Formulário Interativo de Formalização com Divisão Dinâmica */}
      <FormalizacaoVendaForm
        contratacaoId={id}
        clienteNome={cliente?.nome || c.nome}
        formaPagamento={c.forma_pagamento || "Boleto"}
        formalizada={formalizada}
        grupos={grupos}
        participantes={participantes}
        vinculosPerfis={vinculosPerfis}
        regrasParticipantes={regrasParticipantes}
        regrasFranquia={((regrasFranquiaResult.data ?? []) as any)}
        initialGrupoId={grupoSelecionadoId}
        initialCotaId={cotaSelecionadaId}
        initialModalidadeId={modalidadeSelecionadaId}
        initialPrincipalId={consultorSelecionadoId}
        initialPerfilPrincipalId={(c.dados_simulacao as any)?.perfil_principal_id || null}
        initialPerfilSecundarioId={(c.dados_simulacao as any)?.perfil_secundario_id || null}
        initialDataPrimeiraParcela={(c.dados_simulacao as any)?.data_primeira_parcela || null}
        initialDataSegundaParcela={(c.dados_simulacao as any)?.data_segunda_parcela || null}
        initialCronogramaSecundario={(c.dados_simulacao as any)?.cronograma_secundario || "SEGUIR_PRINCIPAL"}
        initialSecundarioId={c.participante_secundario_id}
        initialFracaoSecundario={c.participante_secundario_fracao_percentual}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
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
