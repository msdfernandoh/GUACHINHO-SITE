"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeTemplateCode } from "@/lib/platform/html-sanitizer";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import { normalizePageAppearance, safeImageUrl } from "@/lib/tenant/site-appearance";
import { contactNumber } from "@/lib/tenant/site-contacts";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function criarModeloSitePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const modeloOrigemId = String(formData.get("modelo_origem_id") ?? "").trim() || null;

  if (!nome) {
    return { status: "ERROR", message: "Nome do modelo de site é obrigatório." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_modelo_site", {
    p_nome: nome,
    p_codigo: codigo || null,
    p_descricao: descricao,
    p_modelo_origem_id: modeloOrigemId,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/templates");
  redirect(`/platform/templates/${data}`);
}

export async function duplicarModeloSitePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const modeloId = String(formData.get("modelo_id") ?? "").trim();
  const novoNome = String(formData.get("novo_nome") ?? "").trim() || null;

  if (!modeloId) {
    return { status: "ERROR", message: "ID do modelo é obrigatório." };
  }
  if (!novoNome || novoNome.length > 120) return { status: "ERROR", message: "Informe o nome da cópia (até 120 caracteres)." };

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_duplicar_modelo_site", {
    p_modelo_id: modeloId,
    p_novo_nome: novoNome,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/templates");
  redirect(`/platform/templates/${data}`);
}

export async function salvarModeloSitePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const permiteLogoPropria = formData.get("permite_logo_propria") === "true";
  const logoPadraoUrl = String(formData.get("logo_padrao_url") ?? "").trim() || null;
  if (logoPadraoUrl && !safeImageUrl(logoPadraoUrl)) return { status: "ERROR", message: "Informe uma URL HTTPS ou caminho local válido para a logomarca." };

  let identidadeVisual = null;
  const rawIdentidade = formData.get("identidade_visual_json");
  if (rawIdentidade) {
    try {
      identidadeVisual = JSON.parse(String(rawIdentidade));
      if (!identidadeVisual || typeof identidadeVisual !== "object" || Array.isArray(identidadeVisual)) throw new Error("Identidade inválida");
      identidadeVisual.paginas_blocos = normalizePageAppearance(identidadeVisual.paginas_blocos);
      for (const campo of ["telefone", "whatsapp"] as const) {
        const valor = identidadeVisual.contatos?.[campo];
        if (valor && !contactNumber(valor, campo === "whatsapp")) return { status: "ERROR", message: `Informe ${campo} válido com DDD; telefone também aceita 0800.` };
      }
    } catch {
      return { status: "ERROR", message: "Formato inválido de Identidade Visual (JSON)." };
    }
  }

  let catalogoMenus = null;
  const rawMenus = formData.get("catalogo_menus_json");
  if (rawMenus) {
    try {
      catalogoMenus = JSON.parse(String(rawMenus));
    } catch {
      return { status: "ERROR", message: "Formato inválido de Menus (JSON)." };
    }
  }

  let secoesHome = null;
  const rawSecoes = formData.get("secoes_home_json");
  if (rawSecoes) {
    try {
      secoesHome = JSON.parse(String(rawSecoes));
    } catch {
      return { status: "ERROR", message: "Formato inválido de Seções (JSON)." };
    }
  }

  let configuracaoFooter = null;
  const rawFooter = formData.get("configuracao_footer_json");
  if (rawFooter) {
    try {
      configuracaoFooter = JSON.parse(String(rawFooter));
    } catch {
      return { status: "ERROR", message: "Formato inválido de Footer (JSON)." };
    }
  }

  let codigoCustomizado = null;
  const rawHtml = String(formData.get("html_customizado") ?? "");
  const rawCss = String(formData.get("css_customizado") ?? "");
  if (rawHtml || rawCss) {
    const sanitizado = sanitizeTemplateCode(rawHtml, rawCss);
    codigoCustomizado = {
      html_customizado: sanitizado.sanitizedHtml,
      css_customizado: sanitizado.sanitizedCss,
      sanitizado: true,
      bloqueios: sanitizado.warnings,
      atualizado_em: new Date().toISOString(),
    };
  }

  if (!id || !nome) {
    return { status: "ERROR", message: "ID e Nome do modelo são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_salvar_modelo_site", {
    p_id: id,
    p_nome: nome,
    p_descricao: descricao,
    p_identidade_visual: identidadeVisual,
    p_catalogo_menus: catalogoMenus,
    p_secoes_home: secoesHome,
    p_configuracao_footer: configuracaoFooter,
    p_codigo_customizado: codigoCustomizado,
    p_permite_logo_propria: permiteLogoPropria,
    p_logo_padrao_url: logoPadraoUrl,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath(`/platform/templates/${id}`);
  revalidatePath("/platform/templates");
  revalidatePath("/", "layout");
  return { status: "SUCCESS", message: "Modelo de site atualizado com sucesso." };
}

export async function statusModeloSitePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();

  if (!id || !status) {
    return { status: "ERROR", message: "ID e Status são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_status_modelo_site", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath(`/platform/templates/${id}`);
  revalidatePath("/platform/templates");
  return { status: "SUCCESS", message: `Status alterado para ${status} com sucesso.` };
}

export async function uploadTemplateMediaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim() || "global";
  const slot = String(formData.get("slot") ?? "cards").trim();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { status: "ERROR", message: "Nenhum arquivo de imagem válido foi enviado." };
  }

  // Validação de tipo de arquivo
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  if (!allowedMime.includes(file.type)) {
    return {
      status: "ERROR",
      message: `Formato de arquivo não suportado (${file.type}). Use JPG, PNG, WEBP, GIF ou SVG.`,
    };
  }

  // Limite de 10MB
  const maxBytes = 10_485_760;
  if (file.size > maxBytes) {
    return {
      status: "ERROR",
      message: `O arquivo excede o limite máximo permitido de 10 MB (tamanho: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  try {
    const timestamp = Date.now();
    const sanitizedName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-");
    const storagePath = `templates/${templateId}/${slot}/${timestamp}-${sanitizedName}`;

    const publicUrl = await uploadImagemPublica("site-template-assets", storagePath, file);

    return {
      status: "SUCCESS",
      message: "Imagem enviada para o Storage com sucesso.",
      data: {
        url: publicUrl,
        fileName: file.name,
        sizeBytes: file.size,
        path: storagePath,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha no upload para o Supabase Storage.";
    return { status: "ERROR", message: msg };
  }
}

