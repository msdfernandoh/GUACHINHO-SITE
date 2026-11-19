import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Acrescimo } from "./motor";

const db = () => createAdminClient({ noStore: true });

/**
 * DONO: master do ERP. GERENTE: usuário gerencial do portal (ou usuário do ERP
 * com autorização de envio). VENDEDOR: usuário do portal ou demais usuários do ERP.
 * Usuários criados pelo portal não têm linha em `usuarios`, então não entram no ERP.
 */
export type Papel = "DONO" | "GERENTE" | "VENDEDOR";

export type Acesso = {
  papel: Papel;
  authUserId: string;
  nome: string;
  email: string;
  origem: "ERP" | "PORTAL";
  adicional: Acrescimo;
  telefone: string | null;
  logoUrl: string | null;
};

export const podeGerenciar = (a: Acesso | null) => a?.papel === "DONO" || a?.papel === "GERENTE";

export async function getAcesso(empresaId: string): Promise<Acesso | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: portal }, { data: erp }] = await Promise.all([
    db().from("contempladas_usuarios").select("*").eq("empresa_id", empresaId).eq("auth_user_id", user.id).maybeSingle(),
    db().from("usuarios").select("id,nome,email,perfil,ativo,contempladas_pode_enviar,telefone").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  const adicional: Acrescimo = portal
    ? { tipo: portal.adicional_tipo, valor: Number(portal.adicional_valor) || 0 }
    : { tipo: "FIXO", valor: 0 };

  if (erp?.ativo) {
    const { data: vinc } = await db().from("empresa_usuarios").select("usuario_id").eq("empresa_id", empresaId).eq("usuario_id", erp.id).maybeSingle();
    if (vinc || erp.perfil === "master") {
      const papel: Papel = erp.perfil === "master" ? "DONO" : erp.contempladas_pode_enviar || portal?.papel === "GERENTE" ? "GERENTE" : "VENDEDOR";
      return { papel, authUserId: user.id, nome: portal?.nome || erp.nome, email: erp.email, origem: "ERP", adicional, telefone: portal?.telefone ?? (erp as { telefone?: string | null }).telefone ?? null, logoUrl: portal?.logo_url ?? null };
    }
  }
  if (portal?.ativo && (portal.status ?? "ATIVO") === "ATIVO") {
    return { papel: portal.papel, authUserId: user.id, nome: portal.nome, email: portal.email, origem: "PORTAL", adicional, telefone: portal.telefone, logoUrl: portal.logo_url };
  }
  return null;
}

export async function salvarPerfil(empresaId: string, a: Acesso, perfil: { adicional: Acrescimo; telefone: string | null; logoUrl: string | null }) {
  const { error } = await db()
    .from("contempladas_usuarios")
    .upsert(
      {
        empresa_id: empresaId,
        auth_user_id: a.authUserId,
        nome: a.nome,
        email: a.email,
        papel: a.papel === "VENDEDOR" ? "VENDEDOR" : "GERENTE",
        adicional_tipo: perfil.adicional.tipo,
        adicional_valor: perfil.adicional.valor,
        telefone: perfil.telefone,
        logo_url: perfil.logoUrl,
      },
      { onConflict: "empresa_id,auth_user_id" },
    );
  if (error) throw new Error(error.message);
}

/* ------------------------------ Cadastro ------------------------------ */

export async function criarUsuarioPortal(p: {
  empresaId: string;
  nome: string;
  email: string;
  telefone: string | null;
  senha: string;
  papel: "GERENTE" | "VENDEDOR";
  criadoPor: string | null;
  extras?: { administradora?: string | null; cidade?: string | null; empresa?: string | null; cnpj?: string | null; cpf?: string | null; tipo_cadastro?: string | null };
  pendente?: boolean;
}) {
  const email = p.email.trim().toLowerCase();
  const { data: criado, error } = await db().auth.admin.createUser({
    email,
    password: p.senha,
    email_confirm: true,
    user_metadata: { nome: p.nome, origem: "contempladas" },
  });
  if (error || !criado.user) {
    if (/already|registered|exists/i.test(error?.message ?? "")) throw new Error("E-mail já cadastrado. Entre com a senha que já usa.");
    throw new Error(error?.message ?? "Não foi possível cadastrar.");
  }
  const { error: e2 } = await db().from("contempladas_usuarios").insert({
    empresa_id: p.empresaId,
    auth_user_id: criado.user.id,
    nome: p.nome.trim(),
    email,
    telefone: p.telefone,
    papel: p.papel,
    criado_por: p.criadoPor,
    ...(p.extras ?? {}),
    status: p.pendente ? "PENDENTE" : "ATIVO",
    ativo: !p.pendente,
  });
  if (e2) {
    await db().auth.admin.deleteUser(criado.user.id);
    throw new Error(e2.message);
  }
  return criado.user.id;
}

export type MembroPortal = {
  id: string;
  auth_user_id: string;
  pix?: { tipo: string; chave: string; favorecido: string } | null;
  nome: string;
  email: string;
  telefone: string | null;
  papel: "GERENTE" | "VENDEDOR";
  ativo: boolean;
  status: "ATIVO" | "PENDENTE" | "RECUSADO";
  administradora: string | null;
  cidade: string | null;
  empresa: string | null;
  cnpj: string | null;
  cpf: string | null;
  tipo_cadastro: string | null;
  created_at: string;
};

export async function listarUsuariosPortal(empresaId: string) {
  const { data } = await db()
    .from("contempladas_usuarios")
    .select("id,auth_user_id,nome,email,telefone,papel,ativo,status,administradora,cidade,empresa,cnpj,cpf,tipo_cadastro,created_at")
    .eq("empresa_id", empresaId)
    .order("nome");
  const pix = await pixDosMembros(empresaId);
  return ((data ?? []) as MembroPortal[]).map((m) => ({ ...m, pix: pix.get(m.auth_user_id) ?? null }));
}

export async function atualizarUsuarioPortal(empresaId: string, id: string, campos: { ativo?: boolean; papel?: "GERENTE" | "VENDEDOR"; status?: "ATIVO" | "PENDENTE" | "RECUSADO" }) {
  const { error } = await db().from("contempladas_usuarios").update(campos).eq("empresa_id", empresaId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function criarConvite(empresaId: string, criadoPor: string, papel: "GERENTE" | "VENDEDOR") {
  const token = randomBytes(18).toString("base64url");
  const { error } = await db()
    .from("contempladas_convites")
    .insert({ token, empresa_id: empresaId, criado_por: criadoPor, papel, expira_em: new Date(Date.now() + 7 * 86400000).toISOString() });
  if (error) throw new Error(error.message);
  return token;
}

export async function lerConvite(empresaId: string, token: string) {
  const { data } = await db().from("contempladas_convites").select("*").eq("empresa_id", empresaId).eq("token", token).maybeSingle();
  if (!data || new Date(data.expira_em).getTime() < Date.now()) return null;
  return data as { token: string; papel: "GERENTE" | "VENDEDOR"; criado_por: string | null; usos: number };
}

export async function usarConvite(token: string, usos: number) {
  await db().from("contempladas_convites").update({ usos: usos + 1 }).eq("token", token);
}

/** Gerentes que podem ser donos de cotas (portal e ERP com autorização), com o nome da unidade. */
export async function listarGerentes(empresaId: string) {
  const [{ data: portal }, { data: vinc }, { data: cfgs }] = await Promise.all([
    db().from("contempladas_usuarios").select("auth_user_id,nome").eq("empresa_id", empresaId).eq("papel", "GERENTE").eq("ativo", true),
    db().from("empresa_usuarios").select("usuario_id").eq("empresa_id", empresaId),
    db().from("contempladas_gerente_config").select("auth_user_id,unidade").eq("empresa_id", empresaId),
  ]);
  const ids = (vinc ?? []).map((v) => v.usuario_id as string);
  const { data: erp } = ids.length
    ? await db().from("usuarios").select("auth_user_id,nome").in("id", ids).eq("ativo", true).eq("contempladas_pode_enviar", true).neq("perfil", "master")
    : { data: [] };
  const unidade = new Map((cfgs ?? []).map((c) => [c.auth_user_id as string, c.unidade as string | null]));
  const mapa = new Map<string, { authUserId: string; nome: string; unidade: string | null }>();
  for (const g of [...(portal ?? []), ...(erp ?? [])]) {
    if (!g.auth_user_id) continue;
    mapa.set(g.auth_user_id, { authUserId: g.auth_user_id, nome: g.nome, unidade: unidade.get(g.auth_user_id) ?? null });
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Situação do cadastro de quem está logado, para mostrar "aguardando aprovação". */
export async function situacaoCadastro(empresaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await db().from("contempladas_usuarios").select("status,ativo,nome").eq("empresa_id", empresaId).eq("auth_user_id", user.id).maybeSingle();
  return data ? { status: (data.status as string) ?? "ATIVO", ativo: data.ativo as boolean, nome: data.nome as string } : null;
}

/** Dados do próprio cadastro (Meu perfil). */
export async function meusDados(empresaId: string, a: Acesso) {
  const { data } = await db()
    .from("contempladas_usuarios")
    .select("nome,email,telefone,administradora,cidade,empresa,cnpj,cpf")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", a.authUserId)
    .maybeSingle();
  return {
    nome: (data?.nome as string) ?? a.nome,
    email: (data?.email as string) ?? a.email,
    telefone: (data?.telefone as string) ?? a.telefone,
    administradora: (data?.administradora as string) ?? null,
    cidade: (data?.cidade as string) ?? null,
    empresa: (data?.empresa as string) ?? null,
    cnpj: (data?.cnpj as string) ?? null,
    cpf: (data?.cpf as string) ?? null,
  };
}

/** Atualiza nome, contato, empresa e, para usuários do portal, e-mail e senha de login. */
export async function atualizarMeusDados(
  empresaId: string,
  a: Acesso,
  d: { nome: string; email: string; telefone: string | null; administradora: string | null; cidade: string | null; empresa: string | null; cnpj: string | null; cpf: string | null; senha: string | null },
) {
  const email = d.email.trim().toLowerCase();
  if (a.origem === "PORTAL") {
    const mudarEmail = email && email !== a.email.toLowerCase();
    if (mudarEmail || d.senha) {
      const { error } = await db().auth.admin.updateUserById(a.authUserId, {
        ...(mudarEmail ? { email, email_confirm: true } : {}),
        ...(d.senha ? { password: d.senha } : {}),
      });
      if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "Esse e-mail já está em uso." : error.message);
    }
  } else if (d.senha) {
    // Usuário do ERP: troca a senha do mesmo login; e-mail é alterado no ERP.
    const { error } = await db().auth.admin.updateUserById(a.authUserId, { password: d.senha });
    if (error) throw new Error(error.message);
  }
  const { error } = await db()
    .from("contempladas_usuarios")
    .upsert(
      {
        empresa_id: empresaId,
        auth_user_id: a.authUserId,
        papel: a.papel === "VENDEDOR" ? "VENDEDOR" : "GERENTE",
        nome: d.nome.trim(),
        email: a.origem === "PORTAL" ? email : a.email,
        telefone: d.telefone,
        administradora: d.administradora,
        cidade: d.cidade,
        empresa: d.empresa,
        cnpj: d.cnpj,
        cpf: d.cpf,
      },
      { onConflict: "empresa_id,auth_user_id" },
    );
  if (error) throw new Error(error.message);
}

/** Dono do portal edita os dados de um membro da equipe (e pode definir nova senha). */
export async function authDoMembro(empresaId: string, id: string) {
  const { data } = await db().from("contempladas_usuarios").select("auth_user_id").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  return (data?.auth_user_id as string) ?? null;
}

export async function editarMembro(
  empresaId: string,
  id: string,
  d: { nome: string; email: string; telefone: string | null; administradora: string | null; cidade: string | null; empresa: string | null; cnpj: string | null; cpf: string | null; papel: "GERENTE" | "VENDEDOR"; senha: string | null },
) {
  const { data: m } = await db().from("contempladas_usuarios").select("auth_user_id,email").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  if (!m) throw new Error("Usuário não encontrado.");
  const email = d.email.trim().toLowerCase();
  const mudarEmail = email && email !== String(m.email).toLowerCase();
  if (mudarEmail || d.senha) {
    const { error } = await db().auth.admin.updateUserById(m.auth_user_id as string, {
      ...(mudarEmail ? { email, email_confirm: true } : {}),
      ...(d.senha ? { password: d.senha } : {}),
    });
    if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "Esse e-mail já está em uso." : error.message);
  }
  const { error } = await db()
    .from("contempladas_usuarios")
    .update({ nome: d.nome.trim(), email, telefone: d.telefone, administradora: d.administradora, cidade: d.cidade, empresa: d.empresa, cnpj: d.cnpj, cpf: d.cpf, papel: d.papel })
    .eq("empresa_id", empresaId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** PIX da unidade de um administrador de cotas (usado no Negociar das cotas dele). */
export async function salvarPixMembro(empresaId: string, authUserId: string, pix: { tipo: string; chave: string | null; favorecido: string | null }) {
  const { error } = await db()
    .from("contempladas_gerente_config")
    .upsert(
      { empresa_id: empresaId, auth_user_id: authUserId, chave_pix_tipo: pix.tipo, chave_pix: pix.chave, favorecido_pix: pix.favorecido, updated_at: new Date().toISOString() },
      { onConflict: "empresa_id,auth_user_id" },
    );
  if (error) throw new Error(error.message);
}

export async function pixDosMembros(empresaId: string) {
  const { data } = await db().from("contempladas_gerente_config").select("auth_user_id,chave_pix,chave_pix_tipo,favorecido_pix").eq("empresa_id", empresaId);
  return new Map((data ?? []).map((r) => [r.auth_user_id as string, { tipo: (r.chave_pix_tipo as string) ?? "CELULAR", chave: (r.chave_pix as string) ?? "", favorecido: (r.favorecido_pix as string) ?? "" }]));
}
