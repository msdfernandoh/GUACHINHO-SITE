import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StatusOperacionalContratacao =
  | "AGUARDANDO_ASSINATURA"
  | "AGUARDANDO_FORMALIZACAO"
  | "EM_CONFERENCIA"
  | "PRONTO_FORMALIZAR"
  | "FORMALIZADA"
  | "PENDENCIA"
  | "INVALIDADA";

export type ContratacaoOperacional = {
  id: string;
  protocolo: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  contratoAssinado: boolean;
  contratoAssinadoEm: string | null;
  createdAt: string;
  administradora: string | null;
  grupo: string | null;
  grupoId: string | null;
  credito: number | null;
  parcela: number | null;
  consultor: string | null;
  status: StatusOperacionalContratacao;
  pendencia: string | null;
  clienteId: string | null;
  vendaId: string | null;
  cotaId: string | null;
};

type Raw = Record<string, unknown>;

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return (value as T | null) ?? null;
}

export function resolverStatusOperacional(input: {
  contratoAssinado: boolean;
  statusPersistido?: string | null;
  vendaId?: string | null;
  cotaId?: string | null;
  pendencia?: string | null;
}): StatusOperacionalContratacao {
  if (input.vendaId && input.cotaId) return "FORMALIZADA";
  if (!input.contratoAssinado) return "AGUARDANDO_ASSINATURA";
  if (input.pendencia || input.statusPersistido === "PENDENCIA") return "PENDENCIA";
  if (input.statusPersistido === "EM_CONFERENCIA") return "EM_CONFERENCIA";
  if (input.statusPersistido === "PRONTO_FORMALIZAR") return "PRONTO_FORMALIZAR";
  if (input.statusPersistido === "INVALIDADA") return "INVALIDADA";
  return "AGUARDANDO_FORMALIZACAO";
}

export async function listarContratacoesOperacionais(empresaId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contratacoes_online")
    .select(
      "id,protocolo,nome,razao_social,tipo_pessoa,cpf,cnpj,telefone,contrato_assinado,contrato_assinado_em,created_at,administradora,grupo_nome,grupo_id,credito_selecionado,parcela_estimada,gerado_por_nome,status_operacional_erp,pendencia_descricao,cliente_id,vendas(id,cotas_definitivas(id))",
    )
    .eq("empresa_id", empresaId)
    .order("contrato_assinado_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Raw[]).map((row): ContratacaoOperacional => {
    const venda = one<{ id: string; cotas_definitivas: unknown }>(row.vendas);
    const cota = one<{ id: string }>(venda?.cotas_definitivas);
    const assinado = Boolean(row.contrato_assinado);
    const pendencia = (row.pendencia_descricao as string | null) ?? null;
    return {
      id: String(row.id),
      protocolo: String(row.protocolo || "—"),
      nome: String(row.tipo_pessoa === "cnpj" ? row.razao_social || row.nome || "Cliente" : row.nome || "Cliente"),
      documento: (row.tipo_pessoa === "cnpj" ? row.cnpj : row.cpf) as string | null,
      telefone: row.telefone as string | null,
      contratoAssinado: assinado,
      contratoAssinadoEm: row.contrato_assinado_em as string | null,
      createdAt: String(row.created_at),
      administradora: row.administradora as string | null,
      grupo: row.grupo_nome as string | null,
      grupoId: row.grupo_id as string | null,
      credito: row.credito_selecionado == null ? null : Number(row.credito_selecionado),
      parcela: row.parcela_estimada == null ? null : Number(row.parcela_estimada),
      consultor: row.gerado_por_nome as string | null,
      status: resolverStatusOperacional({
        contratoAssinado: assinado,
        statusPersistido: row.status_operacional_erp as string | null,
        vendaId: venda?.id,
        cotaId: cota?.id,
        pendencia,
      }),
      pendencia,
      clienteId: row.cliente_id as string | null,
      vendaId: venda?.id ?? null,
      cotaId: cota?.id ?? null,
    };
  });
}

export function ordenarFilaContratacoes(rows: ContratacaoOperacional[]) {
  const ordem: Record<StatusOperacionalContratacao, number> = {
    AGUARDANDO_FORMALIZACAO: 0,
    PRONTO_FORMALIZAR: 0,
    PENDENCIA: 1,
    EM_CONFERENCIA: 2,
    AGUARDANDO_ASSINATURA: 3,
    FORMALIZADA: 4,
    INVALIDADA: 5,
  };
  return [...rows].sort((a, b) => ordem[a.status] - ordem[b.status]);
}

export function tempoAguardando(iso: string | null) {
  if (!iso) return "Assinatura pendente";
  const dias = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (dias === 0) return "Assinado hoje";
  return `Assinado há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}
