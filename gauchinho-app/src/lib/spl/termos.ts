import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const SPL_TERMOS_CHAVE = "spl_termos";

export type TermosSpl = { versao: string; texto: string; atualizado_em: string | null };

/** Termo de parceria das imobiliárias publicado no admin (vazio enquanto não publicado). */
export async function getTermosSpl(): Promise<TermosSpl | null> {
  const { data } = await createAdminClient({ noStore: true })
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", SPL_TERMOS_CHAVE)
    .maybeSingle();
  const v = (data?.valor ?? null) as Partial<TermosSpl> | null;
  if (!v?.texto?.trim() || !v.versao) return null;
  return { versao: String(v.versao), texto: String(v.texto), atualizado_em: v.atualizado_em ?? null };
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
