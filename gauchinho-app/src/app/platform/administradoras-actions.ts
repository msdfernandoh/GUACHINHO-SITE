"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

async function platformDb() {
  if (!(await isPlatformSuperadmin()))
    throw new Error("Somente Platform Superadmin.");
  return createClient();
}

export async function salvarTipoAdministradoraAction(formData: FormData) {
  const db = await platformDb();
  const id = String(formData.get("id") ?? "") || undefined;
  const payload = {
    administradora_id: String(formData.get("administradora_id") ?? ""),
    codigo: String(formData.get("codigo") ?? "")
      .trim()
      .toUpperCase(),
    nome: String(formData.get("nome") ?? "").trim(),
    ativo: true,
  };
  if (!payload.administradora_id || !payload.codigo || !payload.nome)
    throw new Error("Administradora, código e nome são obrigatórios.");
  const query = id
    ? db.from("administradora_tipos").update(payload).eq("id", id)
    : db.from("administradora_tipos").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/platform/administradoras");
}

export async function salvarModalidadeAdministradoraAction(formData: FormData) {
  const db = await platformDb();
  const id = String(formData.get("id") ?? "") || undefined;
  const payload = {
    administradora_id: String(formData.get("administradora_id") ?? ""),
    codigo: String(formData.get("codigo") ?? "")
      .trim()
      .toUpperCase(),
    nome: String(formData.get("nome") ?? "").trim(),
    ativo: true,
  };
  if (!payload.administradora_id || !payload.codigo || !payload.nome)
    throw new Error("Administradora, código e nome são obrigatórios.");
  const query = id
    ? db
        .from("administradora_modalidades_comissao")
        .update(payload)
        .eq("id", id)
    : db.from("administradora_modalidades_comissao").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/platform/administradoras");
}

export async function criarCurvaEstornoAction(formData: FormData) {
  const db = await platformDb();
  const administradoraId = String(formData.get("administradora_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const versao = Number(formData.get("versao"));
  const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "");
  const faixas = String(formData.get("faixas") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [mes, percentual] = item.split(":").map(Number);
      return { mes, percentual };
    });
  if (
    !administradoraId ||
    !nome ||
    !vigenciaInicio ||
    !Number.isInteger(versao) ||
    versao < 1 ||
    !faixas.length ||
    faixas.some(
      (f) =>
        !Number.isInteger(f.mes) ||
        f.mes < 1 ||
        f.percentual < 0 ||
        f.percentual > 100,
    )
  )
    throw new Error("Dados da curva inválidos. Use faixas como 1:80,2:70.");
  const { data: curva, error } = await db
    .from("administradora_curvas_estorno")
    .insert({
      administradora_id: administradoraId,
      nome,
      versao,
      vigencia_inicio: vigenciaInicio,
      ativa: true,
      encerra_na_contemplacao: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: faixaError } = await db
    .from("administradora_curva_estorno_faixas")
    .insert(
      faixas.map((f) => ({
        curva_id: curva.id,
        mes_relativo: f.mes,
        percentual_estorno: f.percentual,
      })),
    );
  if (faixaError) throw new Error(faixaError.message);
  revalidatePath("/platform/administradoras");
}
