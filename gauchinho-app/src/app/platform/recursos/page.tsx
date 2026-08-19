import { createClient } from "@/lib/supabase/server";
import {
  RecursosOverridesClient,
  type OverrideItem,
  type EmpresaOption,
  type ModuloOption,
} from "./client";

export default async function PlatformRecursosOverridesPage() {
  const db = await createClient();

  const [overridesRes, empresasRes, modulosRes, assinaturasRes, quotasRes] = await Promise.all([
    db
      .from("saas_empresa_overrides")
      .select(
        "id, empresa_id, tipo, recurso_codigo, efeito, valor_numerico, valor_booleano, motivo, observacao, vigencia_inicio, vigencia_fim, status, encerrado_em, motivo_encerramento, created_at, empresa:empresas(id, nome_fantasia, slug)",
      )
      .order("created_at", { ascending: false }),
    db
      .from("empresas")
      .select("id, nome_fantasia, slug")
      .order("nome_fantasia", { ascending: true }),
    db
      .from("erp_modulos_catalogo")
      .select("codigo, nome, categoria")
      .order("ordem_padrao", { ascending: true }),
    db
      .from("saas_assinaturas")
      .select(
        "empresa_id, status, usuarios_contratados, sites_parceiros_contratados, dominios_proprios_contratados, plano:saas_planos(id, codigo, nome, modulos_habilitados, limite_usuarios, limite_sites_parceiros, limite_dominios_proprios)",
      ),
    db
      .from("empresa_quotas")
      .select("empresa_id, limite_usuarios, limite_sites_parceiros, limite_dominios_proprios"),
  ]);

  const rawOverrides = overridesRes.data ?? [];
  const assinaturasRows = assinaturasRes.data ?? [];

  const empresasOptions: EmpresaOption[] = (empresasRes.data ?? []).map((e) => {
    const ass = assinaturasRows.find((a) => a.empresa_id === e.id && ["ATIVA", "TREINAMENTO", "PENDENTE"].includes(a.status));
    const plano = ass?.plano as {
      nome?: string;
      modulos_habilitados?: string[];
      limite_usuarios?: number;
      limite_sites_parceiros?: number;
      limite_dominios_proprios?: number;
    } | null;

    return {
      id: e.id,
      nome_fantasia: e.nome_fantasia,
      slug: e.slug,
      plano_nome: plano?.nome || "Padrão",
      limite_usuarios_plano: plano?.limite_usuarios ?? 10,
      limite_sites_plano: plano?.limite_sites_parceiros ?? 5,
      limite_dominios_plano: plano?.limite_dominios_proprios ?? 0,
      modulos_plano: plano?.modulos_habilitados || [],
      usuarios_contratados: ass?.usuarios_contratados ?? plano?.limite_usuarios ?? 10,
      sites_contratados: ass?.sites_parceiros_contratados ?? plano?.limite_sites_parceiros ?? 5,
      dominios_contratados: ass?.dominios_proprios_contratados ?? plano?.limite_dominios_proprios ?? 0,
    };
  });

  const formattedOverrides: OverrideItem[] = rawOverrides.map((o) => {
    const emp = (Array.isArray(o.empresa) ? o.empresa[0] : o.empresa) as {
      id: string;
      nome_fantasia: string;
      slug: string;
    } | null;

    const empOpt = empresasOptions.find((e) => e.id === o.empresa_id);

    let planoBase: string | number | null = null;
    if (o.tipo === "LIMITE_USUARIOS") {
      planoBase = empOpt?.limite_usuarios_plano ?? 10;
    } else if (o.tipo === "LIMITE_SITES") {
      planoBase = empOpt?.limite_sites_plano ?? 5;
    } else if (o.tipo === "LIMITE_DOMINIOS_PROPRIOS") {
      planoBase = empOpt?.limite_dominios_plano ?? 0;
    } else if (o.tipo === "MODULO_ERP") {
      const incluso = empOpt?.modulos_plano?.includes(o.recurso_codigo);
      planoBase = incluso ? "Incluso no Plano" : "Não incluso";
    }

    return {
      id: o.id,
      empresa_id: o.empresa_id,
      tipo: o.tipo || "MODULO_ERP",
      recurso_codigo: o.recurso_codigo,
      efeito: o.efeito as "LIBERAR" | "BLOQUEAR",
      valor_numerico: o.valor_numerico,
      valor_booleano: o.valor_booleano,
      motivo: o.motivo,
      observacao: o.observacao,
      vigencia_inicio: o.vigencia_inicio,
      vigencia_fim: o.vigencia_fim,
      status: o.status || "ATIVO",
      encerrado_em: o.encerrado_em,
      motivo_encerramento: o.motivo_encerramento,
      created_at: o.created_at,
      empresa: emp,
      plano_valor_base: planoBase,
      contratado_valor: planoBase,
    };
  });

  const modulosOptions: ModuloOption[] = (modulosRes.data ?? []).map((m) => ({
    codigo: m.codigo,
    nome: m.nome,
    categoria: m.categoria || "Geral",
  }));

  return (
    <RecursosOverridesClient
      overrides={formattedOverrides}
      empresas={empresasOptions}
      modulos={modulosOptions}
    />
  );
}

