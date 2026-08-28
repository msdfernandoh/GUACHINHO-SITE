import { redirect } from "next/navigation";
import Link from "next/link";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PlatformUsuariosClient,
  type PlatformUsuarioItem,
  type MasterFranquiaOption,
  type PapelOption,
  type ModuloOption,
} from "./client";

export default async function PlatformUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa_id?: string; novo?: string; retorno?: string }>;
}) {
  const filtros = await searchParams;
  if (!(await isPlatformSuperadmin())) redirect("/login?next=/platform/usuarios");
  const db = createAdminClient();

  const [
    empresaUsuariosRes,
    usuariosRes,
    empresasRes,
    papeisRes,
    modulosRes,
    assinaturasRes,
    quotasRes,
    overridesRes,
  ] = await Promise.all([
    db
      .from("empresa_usuarios")
      .select(
        "id, usuario_id, empresa_id, papel_id, ativo, is_responsavel_principal, status, convite_enviado_em, erp_modulos_visiveis, created_at",
      )
      .order("created_at", { ascending: false }),
    db.from("usuarios").select("id, nome, email, ultimo_acesso"),
    db
      .from("empresas")
      .select("id, nome_fantasia, slug, configuracoes")
      .order("nome_fantasia", { ascending: true }),
    db
      .from("papeis")
      .select("id, codigo, nome, descricao, empresa_id, escopo, ativo")
      .eq("escopo", "COMPANY")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    db
      .from("erp_modulos_catalogo")
      .select("id, codigo, nome, categoria")
      .order("ordem_padrao", { ascending: true }),
    db
      .from("saas_assinaturas")
      .select("empresa_id, status, plano:saas_planos(id, codigo, nome, modulos_habilitados, limite_usuarios)"),
    db
      .from("empresa_quotas")
      .select("empresa_id, limite_usuarios"),
    db
      .from("saas_empresa_overrides")
      .select("empresa_id, recurso_codigo, efeito"),
  ]);

  const rawRows = empresaUsuariosRes.data ?? [];
  const usuariosRows = usuariosRes.data ?? [];
  const empresasRows = empresasRes.data ?? [];
  const assinaturasRows = assinaturasRes.data ?? [];
  const quotasRows = quotasRes.data ?? [];
  const overridesRows = overridesRes.data ?? [];

  const erroCarregamento = empresaUsuariosRes.error || usuariosRes.error || empresasRes.error || papeisRes.error;
  if (erroCarregamento) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-extrabold">Não foi possível carregar os usuários</h1>
        <p className="mt-2 text-sm">{erroCarregamento.message}</p>
        <Link href="/platform/usuarios" className="mt-4 inline-block rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white">
          Tentar novamente
        </Link>
      </section>
    );
  }

  const usuariosPorId = new Map(usuariosRows.map((usuario) => [usuario.id, usuario]));
  const empresasPorId = new Map(empresasRows.map((empresa) => [empresa.id, empresa]));
  const papeisPorId = new Map((papeisRes.data ?? []).map((papel) => [papel.id, papel]));

  const items: PlatformUsuarioItem[] = rawRows.map((r) => {
    const usr = usuariosPorId.get(r.usuario_id);
    const emp = empresasPorId.get(r.empresa_id);
    const pap = papeisPorId.get(r.papel_id);

    return {
      id: r.id,
      usuario_id: r.usuario_id,
      nome: usr?.nome || "Usuário Sem Nome",
      email: usr?.email || "sem-email@sistema",
      empresa_id: r.empresa_id,
      empresa_nome: emp?.nome_fantasia || "Franquia Desconhecida",
      empresa_slug: emp?.slug || "franquia",
      papel_id: r.papel_id,
      papel_nome: pap?.nome || "Papel Indefinido",
      papel_codigo: pap?.codigo || "consultor",
      status: r.status || (r.ativo ? "ATIVO" : "INATIVO"),
      ativo: r.ativo,
      is_responsavel_principal: Boolean(r.is_responsavel_principal),
      erp_modulos_visiveis: Array.isArray(r.erp_modulos_visiveis) ? (r.erp_modulos_visiveis as string[]) : [],
      convite_enviado_em: r.convite_enviado_em,
      ultimo_acesso: usr?.ultimo_acesso || null,
      created_at: r.created_at,
    };
  });

  const franquiasOptions: MasterFranquiaOption[] = empresasRows.map((e) => {
    const totalAtivos = rawRows.filter((u) => u.empresa_id === e.id && u.ativo).length;
    const quota = quotasRows.find((q) => q.empresa_id === e.id);
    const ass = assinaturasRows.find((a) => a.empresa_id === e.id);
    const plano = ass?.plano as { modulos_habilitados?: string[]; limite_usuarios?: number } | null;

    const modulosBase = plano?.modulos_habilitados || [];
    const modulosOverrides = overridesRows
      .filter((o) => o.empresa_id === e.id && o.efeito === "LIBERAR")
      .map((o) => o.recurso_codigo);
    const modulosPermitidos = Array.from(new Set([...modulosBase, ...modulosOverrides]));

    const config = (e.configuracoes as Record<string, unknown> | null) ?? {};
    const erpConfig = config.erp_sistema as { habilitado?: boolean } | undefined;

    return {
      id: e.id,
      nome_fantasia: e.nome_fantasia,
      slug: e.slug,
      usuarios_ativos: totalAtivos,
      limite_usuarios: Number(quota?.limite_usuarios || plano?.limite_usuarios || 10),
      modulos_permitidos: modulosPermitidos,
      erp_habilitado: Boolean(erpConfig?.habilitado),
    };
  });

  const papeisOptions: PapelOption[] = (papeisRes.data ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    descricao: p.descricao,
    empresa_id: p.empresa_id,
  }));

  const modulosOptions: ModuloOption[] = (modulosRes.data ?? []).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    categoria: m.categoria,
  }));

  const empresaInicialId = franquiasOptions.some((empresa) => empresa.id === filtros.empresa_id)
    ? filtros.empresa_id
    : undefined;
  const retornoEmpresaHref =
    empresaInicialId && filtros.retorno === `/platform/empresas/${empresaInicialId}`
      ? filtros.retorno
      : undefined;

  return (
    <PlatformUsuariosClient
      usuarios={items}
      franquias={franquiasOptions}
      papeis={papeisOptions}
      modulosCatalogo={modulosOptions}
      empresaInicialId={empresaInicialId}
      abrirConviteInicial={Boolean(empresaInicialId && filtros.novo === "1")}
      retornoEmpresaHref={retornoEmpresaHref}
    />
  );
}
