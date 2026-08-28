import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { requireCurrentTenantContext, requireTenantPermission } from "@/lib/tenant/context";
import { getGrupoAutorizadoForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

export const GRUPO_TABELA_BUCKET = "grupos-tabelas";
export const GRUPO_TABELA_MAX_BYTES = 15 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type GrupoTabelaMetadata = {
  id: string;
  grupo_id: string;
  arquivo_path: string;
  arquivo_nome: string;
  mime_type: string;
  tamanho_bytes: number;
  uploaded_at: string;
  uploaded_by_usuario_id: string | null;
  uploaded_by_empresa_id: string | null;
  origem_portal: "SITE" | "ERP" | "PLATFORM";
};

export async function listarTabelasGrupos(grupoIds: string[]) {
  if (!grupoIds.length) return new Map<string, GrupoTabelaMetadata>();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("grupos_tabelas")
    .select("id,grupo_id,arquivo_path,arquivo_nome,mime_type,tamanho_bytes,uploaded_at,uploaded_by_usuario_id,uploaded_by_empresa_id,origem_portal")
    .in("grupo_id", grupoIds);
  if (error) {
    if (error.code === "42P01" || /grupos_tabelas/.test(error.message)) return new Map();
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((row) => [row.grupo_id, row as GrupoTabelaMetadata]));
}

export async function buscarTabelaGrupo(grupoId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("grupos_tabelas")
    .select("id,grupo_id,arquivo_path,arquivo_nome,mime_type,tamanho_bytes,uploaded_at,uploaded_by_usuario_id,uploaded_by_empresa_id,origem_portal")
    .eq("grupo_id", grupoId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || /grupos_tabelas/.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data as GrupoTabelaMetadata | null;
}

async function assertGrupoTenant(grupoId: string, write: boolean) {
  const context = write
    ? await requireTenantPermission("gerenciar_grupos")
    : await requireCurrentTenantContext();
  await getGrupoAutorizadoForEmpresa(context.empresaAtiva.id, grupoId);
  return context;
}

export async function uploadTabelaGrupo(
  grupoId: string,
  origemPortal: "SITE" | "ERP" | "PLATFORM",
  arquivo: File,
) {
  let uploadedByUsuarioId: string | null = null;
  let uploadedByEmpresaId: string | null = null;
  if (origemPortal === "PLATFORM") {
    if (!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin pode enviar a tabela global.");
    const db = await createClient();
    const { data: authData } = await db.auth.getUser();
    if (authData.user) {
      const adminIdentity = createAdminClient();
      const { data: usuario } = await adminIdentity
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      uploadedByUsuarioId = usuario?.id ?? null;
    }
  } else {
    const context = await assertGrupoTenant(grupoId, true);
    uploadedByUsuarioId = context.usuario.id;
    uploadedByEmpresaId = context.empresaAtiva.id;
  }
  if (!(arquivo instanceof File) || arquivo.size <= 0) throw new Error("Selecione uma tabela para enviar.");
  if (arquivo.size > GRUPO_TABELA_MAX_BYTES) throw new Error("A tabela deve ter no máximo 15 MB.");
  const extension = MIME_EXTENSION[arquivo.type];
  if (!extension) throw new Error("Formato não permitido. Envie PDF, JPG, PNG ou WEBP.");

  const admin = createAdminClient();
  const anterior = await buscarTabelaGrupo(grupoId);
  const arquivoPath = `${grupoId}/tabela-atual.${extension}`;
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(GRUPO_TABELA_BUCKET)
    .upload(arquivoPath, bytes, { contentType: arquivo.type, upsert: true, cacheControl: "0" });
  if (uploadError) throw new Error(`Falha ao armazenar a tabela: ${uploadError.message}`);

  const uploadedAt = new Date().toISOString();
  const metadata = {
    grupo_id: grupoId,
    bucket_id: GRUPO_TABELA_BUCKET,
    arquivo_path: arquivoPath,
    arquivo_nome: arquivo.name.slice(0, 240),
    mime_type: arquivo.type,
    tamanho_bytes: arquivo.size,
    uploaded_at: uploadedAt,
    uploaded_by_usuario_id: uploadedByUsuarioId,
    uploaded_by_empresa_id: uploadedByEmpresaId,
    origem_portal: origemPortal,
    updated_at: uploadedAt,
  };
  const { data, error } = await admin
    .from("grupos_tabelas")
    .upsert(metadata, { onConflict: "grupo_id" })
    .select("id,grupo_id,arquivo_path,arquivo_nome,mime_type,tamanho_bytes,uploaded_at,uploaded_by_usuario_id,uploaded_by_empresa_id,origem_portal")
    .single();
  if (error) throw new Error(`Arquivo enviado, mas os metadados não foram registrados: ${error.message}`);

  const { error: historyError } = await admin.from("grupos_tabelas_historico").insert({
    grupo_id: grupoId,
    arquivo_path: arquivoPath,
    arquivo_nome: metadata.arquivo_nome,
    mime_type: arquivo.type,
    tamanho_bytes: arquivo.size,
    uploaded_at: uploadedAt,
    uploaded_by_usuario_id: uploadedByUsuarioId,
    uploaded_by_empresa_id: uploadedByEmpresaId,
    origem_portal: origemPortal,
  });
  if (historyError) throw new Error(`Tabela salva, mas a auditoria falhou: ${historyError.message}`);

  if (anterior?.arquivo_path && anterior.arquivo_path !== arquivoPath) {
    await admin.storage.from(GRUPO_TABELA_BUCKET).remove([anterior.arquivo_path]);
  }
  return data as GrupoTabelaMetadata;
}

export async function criarUrlTabelaGrupo(grupoId: string) {
  await assertGrupoTenant(grupoId, false);
  const tabela = await buscarTabelaGrupo(grupoId);
  if (!tabela) throw new Error("Este grupo ainda não possui tabela enviada.");
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(GRUPO_TABELA_BUCKET)
    .createSignedUrl(tabela.arquivo_path, 300, { download: false });
  if (error || !data?.signedUrl) throw new Error(error?.message || "Não foi possível abrir a tabela.");
  return { url: data.signedUrl, tabela };
}
