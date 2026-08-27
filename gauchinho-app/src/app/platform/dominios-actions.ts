"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { diagnosticarDnsEmpresaDominio, verificarHttpsEmpresaDominio, VERCEL_APEX_IP, VERCEL_CNAME } from "@/lib/platform/empresa-dominio-dns.server";
import {
  dnsRegistrosPreferenciaisFromVercelConfig,
  getDefaultVercelDomainsClient,
  hasVercelDomainsApiCredentials,
} from "@/lib/parceiros/vercel-domains.server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

function instrucoesDnsPadrao(valor: string, tipo: string) {
  return {
    registros_esperados:
      tipo === "SUBDOMINIO" || valor.split(".").length > 2
        ? [{ tipo: "CNAME", host: valor, valor: VERCEL_CNAME, origem: "padrao_vercel" }]
        : [{ tipo: "A", host: "@", valor: VERCEL_APEX_IP, origem: "padrao_vercel" }],
    nota: "Cadastre estes registros no provedor onde o DNS do domínio é administrado.",
  };
}

async function prepararDominioNaVercel(valor: string, tipo: string) {
  if (!hasVercelDomainsApiCredentials()) {
    return {
      status: "PENDENTE" as const,
      instrucoes: null,
      erro: "Automação Vercel sem token no ambiente. Adicione o domínio manualmente ao projeto guachinho-site.",
    };
  }

  const client = getDefaultVercelDomainsClient();
  const add = await client.addDomain(valor);
  if (!add.ok) return { status: "ERRO" as const, instrucoes: null, erro: add.error };
  const config = await client.getDomainConfig(valor);
  const isSubdominio = tipo === "SUBDOMINIO" || valor.split(".").length > 2;
  return {
    status: "ADICIONADO" as const,
    instrucoes: config.ok
      ? dnsRegistrosPreferenciaisFromVercelConfig(config.data, valor, isSubdominio)
      : null,
    erro: config.ok ? null : config.error,
  };
}

export async function criarDominioTenantPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim().toLowerCase();
  const tipo = String(formData.get("tipo") ?? "DOMINIO_CUSTOMIZADO").trim();
  const principal = formData.get("principal") === "true";
  const ativo = formData.get("ativo") !== "false";

  if (!empresaId || !valor) {
    return { status: "ERROR", message: "Empresa e Domínio são obrigatórios." };
  }

  if (valor === "admin.gauchinhoconsorcios.com.br" || valor.startsWith("admin.")) {
    return {
      status: "ERROR",
      message: "O domínio admin.gauchinhoconsorcios.com.br é reservado para a PLATAFORMA SAAS.",
    };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_dominio_tenant", {
    p_empresa_id: empresaId,
    p_valor: valor,
    p_tipo: tipo,
    p_principal: principal,
    p_ativo: ativo,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  const vercel = await prepararDominioNaVercel(valor, tipo);
  const instrucoesPadrao = instrucoesDnsPadrao(valor, tipo);
  const dnsInstrucoes = vercel.instrucoes?.length
    ? { ...instrucoesPadrao, registros_esperados: vercel.instrucoes, nota: "Registros recomendados pela Vercel." }
    : instrucoesPadrao;
  await db
    .from("empresa_dominios")
    .update({
      status_dns: "PENDENTE_DNS",
      status_vercel: vercel.status,
      status_ssl: "PENDING",
      dns_instrucoes: dnsInstrucoes,
      ultima_mensagem_erro: vercel.erro,
    })
    .eq("id", data);

  revalidatePath("/platform/dominios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return {
    status: "SUCCESS",
    message: vercel.status === "ADICIONADO"
      ? "Domínio cadastrado na franquia e preparado na Vercel. Configure o DNS exibido e clique em Verificar."
      : "Domínio cadastrado. Configure o DNS exibido; a preparação automática na Vercel ainda requer credencial do projeto.",
    data,
  };
}

export async function editarDominioTenantPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim().toLowerCase();
  const tipo = String(formData.get("tipo") ?? "DOMINIO_CUSTOMIZADO").trim();
  const principal = formData.get("principal") === "true";
  const ativo = formData.get("ativo") === "true";
  const confirmarVercel = formData.get("confirmar_vercel") === "true";
  if (!id || !empresaId || !valor) return { status: "ERROR", message: "Domínio, empresa e identificador são obrigatórios." };
  if (valor === "admin.gauchinhoconsorcios.com.br" || valor.startsWith("admin.")) {
    return { status: "ERROR", message: "Domínio reservado para a Platform." };
  }

  const db = await createClient();
  const { data: atual, error: loadError } = await db
    .from("empresa_dominios")
    .select("valor,tipo")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (loadError || !atual) return { status: "ERROR", message: "Domínio não encontrado nesta franquia." };
  const mudouHost = atual.valor !== valor || atual.tipo !== tipo;

  if (principal) {
    await db.from("empresa_dominios").update({ principal: false }).eq("empresa_id", empresaId).neq("id", id);
  }
  const { error } = await db
    .from("empresa_dominios")
    .update({
      valor,
      tipo,
      principal,
      ativo,
      ...(mudouHost
        ? {
            verificado: false,
            status_dns: "PENDENTE_DNS",
            status_vercel: confirmarVercel ? "ADICIONADO" : "PENDENTE",
            status_ssl: "PENDING",
            dns_instrucoes: instrucoesDnsPadrao(valor, tipo),
            ultima_verificacao_em: null,
            ultima_mensagem_erro: null,
          }
        : confirmarVercel
          ? { status_vercel: "ADICIONADO" }
          : {}),
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { status: "ERROR", message: error.message };
  revalidatePath("/platform/dominios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return { status: "SUCCESS", message: "Cadastro do domínio atualizado. Verifique novamente após qualquer alteração de host." };
}

export async function verificarDominioTenantPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return { status: "ERROR", message: "Domínio e empresa são obrigatórios." };
  const db = await createClient();
  const { data: dominio, error: loadError } = await db
    .from("empresa_dominios")
    .select("id,valor,tipo,ativo,status_vercel")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (loadError || !dominio) return { status: "ERROR", message: "Domínio não encontrado nesta franquia." };
  if (!dominio.ativo) return { status: "ERROR", message: "Ative o domínio antes de verificar." };

  const vercel = await prepararDominioNaVercel(dominio.valor, dominio.tipo);
  const diagnostico = await diagnosticarDnsEmpresaDominio(
    dominio.valor,
    dominio.tipo,
    vercel.instrucoes,
  );
  const sslReady = diagnostico.verificado ? await verificarHttpsEmpresaDominio(dominio.valor) : false;
  const verificado = diagnostico.verificado && sslReady;
  const statusVercel = vercel.status === "ADICIONADO" || sslReady ? "ADICIONADO" : dominio.status_vercel;
  const mensagemErro = !diagnostico.verificado
    ? diagnostico.mensagem
    : !sslReady
      ? "DNS correto, mas HTTPS/SSL ainda não está disponível. Aguarde a emissão do certificado e verifique novamente."
      : null;
  const instrucoesPadrao = instrucoesDnsPadrao(dominio.valor, dominio.tipo);
  const { error } = await db
    .from("empresa_dominios")
    .update({
      verificado,
      status_dns: diagnostico.status,
      status_vercel: statusVercel,
      status_ssl: sslReady ? "READY" : "PENDING",
      dns_instrucoes: {
        ...instrucoesPadrao,
        registros_esperados: vercel.instrucoes?.length ? vercel.instrucoes : diagnostico.registros_esperados,
        registros_encontrados: diagnostico.registros_encontrados,
      },
      ultima_verificacao_em: new Date().toISOString(),
      ultima_mensagem_erro: mensagemErro ?? vercel.erro,
    })
    .eq("id", id);
  if (error) return { status: "ERROR", message: error.message };
  revalidatePath("/platform/dominios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return {
    status: verificado ? "SUCCESS" : "ERROR",
    message: verificado
      ? "Domínio, DNS e HTTPS verificados. O site já pode responder por este endereço."
      : mensagemErro ?? vercel.erro ?? "Domínio ainda pendente.",
  };
}

export async function definirDominioPrincipalPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();

  if (!id || !empresaId) {
    return { status: "ERROR", message: "ID do domínio e da empresa são obrigatórios." };
  }

  const db = await createClient();

  // Desmarcar principal anterior
  await db
    .from("empresa_dominios")
    .update({ principal: false, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("principal", true);

  // Marcar novo principal
  const { error } = await db
    .from("empresa_dominios")
    .update({ principal: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/dominios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return { status: "SUCCESS", message: "Domínio definido como principal." };
}

export async function toggleStatusDominioPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const ativo = formData.get("ativo") === "true";

  if (!id) {
    return { status: "ERROR", message: "ID do domínio é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db
    .from("empresa_dominios")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/dominios");
  return { status: "SUCCESS", message: `Domínio ${ativo ? "ativado" : "desativado"} com sucesso.` };
}
