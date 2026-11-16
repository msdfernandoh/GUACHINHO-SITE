import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import padrao from "./termos-padrao.json";
import { MODELOS_COM_TERMO, type CamposTermo, type ContratanteTermo, type ModeloComTermo } from "./termos-preencher";

export const SPL_TERMOS_CHAVE = "spl_termos";

export type TermosSpl = {
  versao: string;
  modelos: Partial<Record<ModeloComTermo, string>>;
  campos: CamposTermo;
  atualizado_em: string | null;
};

/** Termos de parceria por modelo publicados no admin. */
export async function getTermosSpl(): Promise<TermosSpl | null> {
  const { data } = await createAdminClient({ noStore: true })
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", SPL_TERMOS_CHAVE)
    .maybeSingle();
  // Sem publicação no admin, valem os termos padrão das minutas da rede.
  const v = ((data?.valor as Partial<TermosSpl> | null)?.versao ? data!.valor : { ...padrao, atualizado_em: null }) as
    Partial<TermosSpl> & { texto?: string };
  const modelos: TermosSpl["modelos"] = {};
  for (const m of MODELOS_COM_TERMO) {
    const t = v.modelos?.[m] ?? v.texto;
    if (typeof t === "string" && t.trim()) modelos[m] = t;
  }
  if (!Object.keys(modelos).length) return null;
  return { versao: String(v.versao), modelos, campos: v.campos ?? {}, atualizado_em: v.atualizado_em ?? null };
}

/** Modelo do termo para o modelo de parceria (sem termo para "só liberar a carteira"). */
export function termoDoModelo(termos: TermosSpl | null, modelo: string): string | null {
  return termos?.modelos[modelo as ModeloComTermo] ?? null;
}

/** Dados da empresa contratante (o tenant) para a qualificação das partes. */
export async function contratanteDoTermo(empresaId: string): Promise<ContratanteTermo> {
  const { data } = await createAdminClient({ noStore: true })
    .from("empresas")
    .select("razao_social,nome_fantasia,cnpj,endereco,numero,complemento,bairro,cidade,estado,cep")
    .eq("id", empresaId)
    .maybeSingle();
  const e = (data ?? {}) as Record<string, string | null>;
  const cep = String(e.cep ?? "").replace(/\D/g, "");
  const sede = [
    [e.endereco, e.numero].filter(Boolean).join(", "),
    e.complemento,
    e.bairro,
    [e.cidade, e.estado].filter(Boolean).join("/"),
    cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : null,
  ]
    .filter((x) => x && String(x).trim())
    .join(", ");
  return {
    razao_social: e.razao_social || e.nome_fantasia || "",
    cnpj: e.cnpj ?? null,
    sede,
    cidade: [e.cidade, e.estado].filter(Boolean).join("/"),
  };
}

/** Nova versão a cada publicação: quem aceitou a anterior precisa aceitar de novo. */
export function novaVersaoTermos(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getUTCFullYear()}${p(agora.getUTCMonth() + 1)}${p(agora.getUTCDate())}-${p(agora.getUTCHours())}${p(agora.getUTCMinutes())}`;
}

export function dadosDoAceite(request: Request) {
  return {
    termos_aceite_ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null,
    termos_aceite_agente: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
    termos_aceito_em: new Date().toISOString(),
  };
}

export async function registrarAceiteTermos(imobiliariaId: string, empresaId: string, versao: string, request: Request) {
  const { error } = await createAdminClient()
    .from("spl_imobiliarias")
    .update({ termos_versao: versao, ...dadosDoAceite(request) })
    .eq("id", imobiliariaId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível registrar o aceite agora.");
}
