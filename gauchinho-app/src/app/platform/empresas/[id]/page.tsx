import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MasterFranquiaHub,
  type EmpresaHubDetail,
  type AssinaturaHubDetail,
  type BrandingHubDetail,
  type DominioHubItem,
  type AdminHubItem,
  type UsuarioHubItem,
  type SocioHubItem,
  type ParceiroHubItem,
  type ModuloCatalogoHub,
  type OverrideHubItem,
  type PlanoOptionHub,
  type ModeloOptionHub,
  type AdminOptionHub,
  type AuditoriaHubItem,
} from "@/components/platform/master-franquia-hub";

export default async function MasterFranquiaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [
    empresaRes,
    assinaturaRes,
    brandingRes,
    modeloEmpresaRes,
    dominiosRes,
    adminsRes,
    usuariosRes,
    sociosRes,
    parceirosRes,
    modulosCatalogoRes,
    overridesRes,
    planosDisponiveisRes,
    modelosDisponiveisRes,
    adminsDisponiveisRes,
    auditoriaRes,
  ] = await Promise.all([
    db.from("empresas").select("*").eq("id", id).maybeSingle(),
    db
      .from("saas_assinaturas")
      .select("id, status, valor_mensal, valor_total_estimado, taxa_implantacao, usuarios_contratados, sites_parceiros_contratados, sites_dominio_proprio_contratados, data_inicio, plano_id, plano:saas_planos(*)")
      .eq("empresa_id", id)
      .order("created_at", { ascending: false })
      .maybeSingle(),
    db
      .from("empresa_branding")
      .select("id, nome_site, status_publicacao, logo_url")
      .eq("empresa_id", id)
      .maybeSingle(),
    db
      .from("empresa_site_modelos")
      .select("modelo_id, status, menus_habilitados, modelo:site_modelos(id, codigo, nome, descricao, status, versao, identidade_visual)")
      .eq("empresa_id", id)
      .maybeSingle(),
    db
      .from("empresa_dominios")
      .select("id, valor, tipo, principal, ativo, verificado, status_dns, status_vercel, status_ssl")
      .eq("empresa_id", id)
      .order("principal", { ascending: false }),
    db
      .from("empresa_administradoras")
      .select("id, administradora_id, status, administradora:administradoras(id, nome, nome_fantasia, slug)")
      .eq("empresa_id", id),
    db
      .from("empresa_usuarios")
      .select("id, usuario_id, ativo, is_responsavel_principal, status, erp_modulos_visiveis, convite_enviado_em, created_at, usuario:usuarios(id, nome, email, status, ultimo_acesso), papel:papeis(id, nome)")
      .eq("empresa_id", id),
    db
      .from("empresa_socios")
      .select("id, usuario_id, nome, percentual_participacao, vigencia_inicio, observacao, contas:empresa_socio_contas(id, banco_nome, agencia, conta, tipo_chave_pix, chave_pix, favorecido, principal, ativo)")
      .eq("empresa_id", id)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    db
      .from("organizacoes_parceiras")
      .select("id, nome, status, sites:parceiro_sites(id, slug, nome_site, canal_principal, status_publicacao, ativo, branding, template_codigo)")
      .eq("empresa_id", id),
    db
      .from("erp_modulos_catalogo")
      .select("id, codigo, nome, categoria, status")
      .order("ordem_padrao", { ascending: true }),
    db
      .from("saas_empresa_overrides")
      .select("id, recurso_codigo, efeito, motivo")
      .eq("empresa_id", id),
    db
      .from("saas_planos")
      .select("id, codigo, nome, valor_mensal, limite_usuarios, permite_sites_parceiros, max_sites_parceiros, max_sites_dominio_proprio, valor_site_parceiro, valor_site_dominio_proprio, erp_incluido, modulos_habilitados")
      .eq("status", "ATIVO")
      .order("valor_mensal", { ascending: true }),
    db
      .from("site_modelos")
      .select("id, codigo, nome, descricao, status, versao, identidade_visual")
      .eq("status", "PUBLICADO")
      .order("created_at", { ascending: true }),
    db
      .from("administradoras")
      .select("id, nome")
      .eq("status", "ATIVA")
      .order("nome", { ascending: true }),
    db
      .from("plataforma_auditoria")
      .select("id, acao, entidade_tipo, campos_alterados, created_at")
      .eq("entidade_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!empresaRes.data) {
    notFound();
  }
  if (sociosRes.error) {
    throw new Error(`Não foi possível carregar o quadro societário: ${sociosRes.error.message}`);
  }

  const empresaData: EmpresaHubDetail = {
    id: empresaRes.data.id,
    nome_fantasia: empresaRes.data.nome_fantasia,
    razao_social: empresaRes.data.razao_social,
    slug: empresaRes.data.slug,
    cnpj: empresaRes.data.cnpj,
    telefone: empresaRes.data.telefone,
    whatsapp: empresaRes.data.whatsapp,
    email: empresaRes.data.email,
    cep: empresaRes.data.cep,
    endereco: empresaRes.data.endereco,
    numero: empresaRes.data.numero,
    complemento: empresaRes.data.complemento,
    bairro: empresaRes.data.bairro,
    cidade: empresaRes.data.cidade,
    estado: empresaRes.data.estado,
    status: empresaRes.data.status,
    ativo: empresaRes.data.ativo,
    configuracoes: (empresaRes.data.configuracoes as Record<string, unknown> | null) ?? {},
    created_at: empresaRes.data.created_at,
    updated_at: empresaRes.data.updated_at,
  };

  const rawAss = assinaturaRes.data;
  const assinaturaData: AssinaturaHubDetail | null = rawAss
    ? {
        id: rawAss.id,
        status: rawAss.status,
        valor_mensal: Number(rawAss.valor_mensal || 0),
        valor_total_estimado: Number(rawAss.valor_total_estimado || rawAss.valor_mensal || 0),
        taxa_implantacao: Number(rawAss.taxa_implantacao || 0),
        usuarios_contratados: Number(rawAss.usuarios_contratados || 10),
        sites_parceiros_contratados: Number(rawAss.sites_parceiros_contratados || 0),
        sites_dominio_proprio_contratados: Number(rawAss.sites_dominio_proprio_contratados || 0),
        data_inicio: rawAss.data_inicio,
        plano_id: rawAss.plano_id,
        plano: (Array.isArray(rawAss.plano) ? rawAss.plano[0] : rawAss.plano) as unknown as AssinaturaHubDetail["plano"],
      }
    : null;

  const rawBranding = brandingRes.data;
  const rawModeloEmpresa = modeloEmpresaRes.data;
  const modeloEmpresa = rawModeloEmpresa
    ? (Array.isArray(rawModeloEmpresa.modelo) ? rawModeloEmpresa.modelo[0] : rawModeloEmpresa.modelo)
    : null;
  const brandingData: BrandingHubDetail | null = rawBranding
    ? {
        id: rawBranding.id,
        nome_site: rawBranding.nome_site,
        status_publicacao: rawBranding.status_publicacao,
        modelo_id: rawModeloEmpresa?.modelo_id ?? null,
        template_codigo: modeloEmpresa?.codigo ?? null,
        logo_url: rawBranding.logo_url,
        menus: Array.isArray(rawModeloEmpresa?.menus_habilitados)
          ? (rawModeloEmpresa.menus_habilitados as BrandingHubDetail["menus"])
          : [],
        modelo_status: rawModeloEmpresa?.status ?? null,
        modelo: modeloEmpresa as unknown as BrandingHubDetail["modelo"],
      }
    : null;

  const dominiosData: DominioHubItem[] = (dominiosRes.data ?? []).map((d) => ({
    id: d.id,
    valor: d.valor,
    tipo: d.tipo,
    principal: d.principal,
    ativo: d.ativo,
    verificado: d.verificado,
    status_dns: d.status_dns,
    status_vercel: d.status_vercel,
    status_ssl: d.status_ssl,
  }));

  const adminsData: AdminHubItem[] = (adminsRes.data ?? []).map((a) => ({
    id: a.id,
    administradora_id: a.administradora_id,
    status: a.status,
    administradora: (Array.isArray(a.administradora) ? a.administradora[0] : a.administradora) as unknown as AdminHubItem["administradora"],
  }));

  const usuariosData: UsuarioHubItem[] = (usuariosRes.data ?? []).map((u) => ({
    id: u.id,
    usuario_id: u.usuario_id,
    ativo: u.ativo,
    is_responsavel_principal: Boolean(u.is_responsavel_principal),
    status: u.status || (u.ativo ? "ATIVO" : "INATIVO"),
    erp_modulos_visiveis: Array.isArray(u.erp_modulos_visiveis) ? (u.erp_modulos_visiveis as string[]) : [],
    convite_enviado_em: u.convite_enviado_em,
    created_at: u.created_at,
    usuario: (Array.isArray(u.usuario) ? u.usuario[0] : u.usuario) as unknown as UsuarioHubItem["usuario"],
    papel: (Array.isArray(u.papel) ? u.papel[0] : u.papel) as unknown as UsuarioHubItem["papel"],
  }));

  const sociosData: SocioHubItem[] = (sociosRes.data ?? []).map((s) => ({
    id: s.id,
    usuario_id: s.usuario_id,
    nome: s.nome,
    percentual_participacao: Number(s.percentual_participacao),
    vigencia_inicio: s.vigencia_inicio,
    observacao: s.observacao,
    contas: Array.isArray(s.contas)
      ? (s.contas as unknown as SocioHubItem["contas"])
      : [],
  }));

  const parceirosData: ParceiroHubItem[] = (parceirosRes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    status: p.status,
    sites: Array.isArray(p.sites) ? (p.sites as unknown as ParceiroHubItem["sites"]) : [],
  }));

  const modulosCatalogoData: ModuloCatalogoHub[] = (modulosCatalogoRes.data ?? []).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    categoria: m.categoria,
    status: m.status,
  }));

  const overridesData: OverrideHubItem[] = (overridesRes.data ?? []).map((o) => ({
    id: o.id,
    recurso_codigo: o.recurso_codigo,
    efeito: o.efeito,
    motivo: o.motivo,
  }));

  const planosOptions: PlanoOptionHub[] = (planosDisponiveisRes.data ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    valor_mensal: Number(p.valor_mensal || 0),
    limite_usuarios: Number(p.limite_usuarios || 0),
    permite_sites_parceiros: Boolean(p.permite_sites_parceiros),
    max_sites_parceiros: Number(p.max_sites_parceiros || 0),
    max_sites_dominio_proprio: Number(p.max_sites_dominio_proprio || 0),
    valor_site_parceiro: Number(p.valor_site_parceiro || 0),
    valor_site_dominio_proprio: Number(p.valor_site_dominio_proprio || 0),
    erp_incluido: Boolean(p.erp_incluido),
    modulos_habilitados: Array.isArray(p.modulos_habilitados) ? (p.modulos_habilitados as string[]) : [],
  }));

  const modelosOptions: ModeloOptionHub[] = (modelosDisponiveisRes.data ?? []).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    status: m.status,
    versao: Number(m.versao || 1),
    descricao: m.descricao,
    identidade_visual: (m.identidade_visual as Record<string, unknown> | null) ?? {},
  }));

  const adminsOptions: AdminOptionHub[] = (adminsDisponiveisRes.data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
  }));

  const historicoData: AuditoriaHubItem[] = (auditoriaRes.data ?? []).map((h) => ({
    id: h.id,
    acao: h.acao,
    entidade_tipo: h.entidade_tipo,
    campos_alterados: h.campos_alterados,
    created_at: h.created_at,
  }));

  return (
    <MasterFranquiaHub
      empresa={empresaData}
      assinatura={assinaturaData}
      branding={brandingData}
      dominios={dominiosData}
      administradoras={adminsData}
      usuarios={usuariosData}
      socios={sociosData}
      parceiros={parceirosData}
      modulosCatalogo={modulosCatalogoData}
      overrides={overridesData}
      planosDisponiveis={planosOptions}
      modelosDisponiveis={modelosOptions}
      adminsDisponiveis={adminsOptions}
      historico={historicoData}
    />
  );
}

