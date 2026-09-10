import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeTelefone } from "@/lib/contratacoes-online/validacao";

/** Status de propostas que ainda estão em aberto/negociação e podem ser unificadas/atualizadas no mesmo dia. */
export const STATUS_UNIFICAVEIS = ["Gerada", "PDF gerado", "Em negociação", "Enviada", "Aprovada"] as const;

/** Retorna o ISO string representando 00:00:00 do dia atual no fuso horário de Brasília (UTC-3). */
export function getInicioDoDiaBrasilUtc(referenceDate: Date = new Date()): string {
  const dateInBr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate); // Formato YYYY-MM-DD
  const d = new Date(`${dateInBr}T00:00:00-03:00`);
  return d.toISOString();
}

/** Retorna a string da data formatada YYYY-MM-DD no fuso de Brasília. */
export function getDataBrasilString(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return isoDate.slice(0, 10);
  }
}

/** Chave de identificação única do cliente (prioriza telefone sanitizado, fallback para nome normalizado). */
export function extrairIdentificadorCliente(p: {
  whatsapp_cliente?: string | null;
  nome_cliente?: string | null;
}): string {
  const tel = sanitizeTelefone(p.whatsapp_cliente ?? "");
  if (tel && tel.length >= 10) return tel;
  const nome = (p.nome_cliente ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return nome || "cliente-desconhecido";
}

export type PropostaUnificadaGrupo<T> = {
  chave: string;
  dataReferencia: string;
  clienteIdentificador: string;
  propostaPrincipal: T;
  propostasDoDia: T[];
  totalNoDia: number;
};

/**
 * Agrupa propostas do mesmo cliente geradas na mesma data (fuso de Brasília).
 * Cada grupo tem como `propostaPrincipal` a versão mais recente do dia.
 */
export function agruparPropostasPorClienteEData<
  T extends {
    id: string;
    created_at: string;
    whatsapp_cliente?: string | null;
    nome_cliente?: string | null;
  },
>(propostas: T[]): PropostaUnificadaGrupo<T>[] {
  const gruposMap = new Map<string, { propostas: T[]; dataBr: string; clienteId: string }>();

  for (const p of propostas) {
    const dataBr = getDataBrasilString(p.created_at);
    const clienteId = extrairIdentificadorCliente(p);
    const chave = `${clienteId}__${dataBr}`;

    let grupo = gruposMap.get(chave);
    if (!grupo) {
      grupo = { propostas: [], dataBr, clienteId };
      gruposMap.set(chave, grupo);
    }
    grupo.propostas.push(p);
  }

  const resultado: PropostaUnificadaGrupo<T>[] = [];

  for (const [chave, grupo] of gruposMap.entries()) {
    // Ordena da mais recente para a mais antiga
    const ordenadas = [...grupo.propostas].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    resultado.push({
      chave,
      dataReferencia: grupo.dataBr,
      clienteIdentificador: grupo.clienteId,
      propostaPrincipal: ordenadas[0],
      propostasDoDia: ordenadas,
      totalNoDia: ordenadas.length,
    });
  }

  // Ordena os grupos pela data da proposta principal decrescente
  return resultado.sort(
    (a, b) =>
      new Date(b.propostaPrincipal.created_at).getTime() -
      new Date(a.propostaPrincipal.created_at).getTime(),
  );
}

/**
 * Busca uma proposta ativa criada hoje no mesmo tenant para o mesmo cliente.
 * Propostas com status final ('Contratada', 'Cancelada', 'Perdida') NUNCA são retornadas para evitar sobrescrita.
 */
export async function buscarPropostaAtivaDoDia(
  admin: SupabaseClient,
  input: {
    empresaId: string;
    telefone: string;
    nome?: string | null;
  },
): Promise<{ id: string; public_token: string; status: string; preenchimento_contratacao: Record<string, unknown> } | null> {
  const tel = sanitizeTelefone(input.telefone);
  if (!tel || tel.length < 10) return null;

  const inicioDoDia = getInicioDoDiaBrasilUtc();

  // Consulta por telefone na data de hoje que não esteja excluída nem finalizada
  const { data, error } = await admin
    .from("propostas")
    .select("id, public_token, status, preenchimento_contratacao, created_at")
    .eq("empresa_id", input.empresaId)
    .eq("whatsapp_cliente", tel)
    .gte("created_at", inicioDoDia)
    .is("excluido_at", null)
    .not("status", "in", '("Contratada","Cancelada","Perdida")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
