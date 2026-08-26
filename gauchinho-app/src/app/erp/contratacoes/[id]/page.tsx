import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
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
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const admin = createAdminClient();

  const [
    contratacaoResult,
    gruposResult,
    participantesResult,
    vinculosResult,
    regrasParticipantesResult,
    documentosResult,
    historicoResult,
    modalidadesResult,
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
      .from("participante_comissao_perfis")
      .select("id,participante_id,papel_tipo,perfil_id,override_percentual,perfil:comissao_perfis(id,nome,papel_base)")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativo", true),
    admin
      .from("comissao_regras_participantes")
      .select("id,perfil_id,programa_id,percentual_comissao,seguir_cronograma_franquia,etapas_cronograma,base_v2,status")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativa", true),
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
      .from("administradora_modalidades_comissao")
      .select("id,administradora_id,codigo,nome,ativo")
      .eq("ativo", true)
      .order("nome"),
    admin
      .from("comissao_regras_franquia")
      .select("id,programa_id,percentual_total_comissao,tipo_administradora_id,modalidade_comissao_id,ativa,configuracao_homologada,etapas_cronograma,comissao_regra_etapas(id,ordem,percentual_venda,nome,tipo_gatilho)")
      .or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
      .eq("ativa", true),
  ]);

  if (contratacaoResult.error || !contratacaoResult.data) notFound();
  const c = contratacaoResult.data as ContratacaoDetalhe;
  const cliente = relation<{ id: string; nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null }>(c.cliente);
  const venda = relation<{ id: string; status: string; cotas_definitivas: unknown }>(c.vendas);
  const cota = relation<{ id: string; numero_cota: string | null; status: string }>(venda?.cotas_definitivas);
  const formalizada = Boolean(venda?.id && cota?.id);

  const grupos = (gruposResult.data ?? []) as GrupoConsorcio[];
  const participantes = (participantesResult.data ?? []) as ParticipanteComercial[];
  const vinculosPerfis = ((vinculosResult.data ?? []) as unknown) as VinculoPerfil[];
  const regrasParticipantes = ((regrasParticipantesResult.data ?? []) as unknown) as RegraParticipante[];

  // Auto-resolução inteligente do Grupo
  const grupoMatch =
    (c.grupo_id && grupos.find((g) => g.id === c.grupo_id)) ||
    grupos.find((g) => g.codigo_grupo === c.grupo_nome) ||
    grupos.find((g) => c.grupo_nome && g.codigo_grupo === c.grupo_nome.replace(/\D/g, "")) ||
    grupos.find((g) => (c.dados_simulacao as any)?.grupoId === g.id) ||
    grupos[0];

  const grupoSelecionadoId = grupoMatch?.id || "";

  const opcoes = grupos.flatMap((g) =>
    (g.grupos_cotas ?? [])
      .filter((o) => o.ativo !== false)
      .map((o) => ({
        id: o.id,
        grupo_id: g.id,
        grupo_codigo: g.codigo_grupo,
        valor_credito: Number(o.valor_credito),
        valor_parcela: Number(o.valor_parcela),
        prazo: g.prazo_total || 180,
      }))
  );

  const creditoBuscado = Number(
    c.credito_selecionado ||
    (c.dados_simulacao as any)?.valor_credito ||
    (c.dados_simulacao as any)?.somaCotas ||
    (c.dados_simulacao as any)?.selecoes?.[0]?.credito ||
    500000
  );

  const cotaMatch =
    (c.cota_id && opcoes.find((o) => o.id === c.cota_id)) ||
    ((c.dados_simulacao as any)?.cotaId && opcoes.find((o) => o.id === (c.dados_simulacao as any)?.cotaId)) ||
    opcoes.find((o) => o.grupo_id === grupoSelecionadoId && Math.abs(o.valor_credito - creditoBuscado) < 0.01) ||
    opcoes.find((o) => o.grupo_id === grupoSelecionadoId) ||
    opcoes[0];

  const cotaSelecionadaId = cotaMatch?.id || "";

  const consultorSelecionadoId =
    c.participante_comercial_id ||
    participantes[0]?.id ||
    "";

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
        modalidades={((modalidadesResult.data ?? []) as any)}
        regrasFranquia={((regrasFranquiaResult.data ?? []) as any)}
        initialGrupoId={grupoSelecionadoId}
        initialCotaId={cotaSelecionadaId}
        initialModalidadeId={(c.dados_simulacao as any)?.modalidade_comissao_id || grupoMatch?.modalidade_comissao_id || null}
        initialPrincipalId={consultorSelecionadoId}
        initialPerfilPrincipalId={(c.dados_simulacao as any)?.perfil_principal_id || null}
        initialPerfilSecundarioId={(c.dados_simulacao as any)?.perfil_secundario_id || null}
        initialPercentualFranqueadora={(c.dados_simulacao as any)?.percentual_franqueadora ? Number((c.dados_simulacao as any).percentual_franqueadora) : null}
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