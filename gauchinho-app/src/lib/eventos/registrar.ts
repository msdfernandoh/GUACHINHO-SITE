import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrarEventoInput = {
  tipo_evento: string;
  origem?: string;
  pagina?: string;
  entidade_tipo?: string;
  entidade_id?: string;
  lead_id?: string;
  usuario_id?: string;
  carta_id?: string;
  imobiliaria_id?: string;
  imovel_id?: string;
  dados_evento?: Record<string, unknown>;
};

/** Persiste evento de analytics/comercial (service role — insert público). */
export async function registrarEvento(input: RegistrarEventoInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("eventos_site").insert({
    tipo_evento: input.tipo_evento,
    origem: input.origem ?? null,
    pagina: input.pagina ?? null,
    entidade_tipo: input.entidade_tipo ?? null,
    entidade_id: input.entidade_id ?? null,
    lead_id: input.lead_id ?? null,
    usuario_id: input.usuario_id ?? null,
    carta_id: input.carta_id ?? null,
    imobiliaria_id: input.imobiliaria_id ?? null,
    imovel_id: input.imovel_id ?? null,
    dados_evento: input.dados_evento ?? {},
  });
  if (error) {
    console.error("[eventos_site]", error.message);
  }
}
