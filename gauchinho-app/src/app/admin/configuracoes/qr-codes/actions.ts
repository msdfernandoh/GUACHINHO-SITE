"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import {
  atualizarQrCodeUnico,
  criarQrCodeUnico,
  listQrCodesUnicosAdmin,
  atualizarDestinoQrCodeUnico,
  buscarHistoricoDestinosQrCode,
  type QrCodeTipoDestino,
} from "@/lib/eventos-sorteio/qr-unico";

async function assertMaster() {
  const u = await requireUsuario();
  if (!canEditSettings(u.perfil)) throw new Error("Sem permissão");
  return u;
}

export async function fetchQrCodesUnicosAction() {
  await assertMaster();
  return listQrCodesUnicosAdmin();
}

export async function createQrCodeUnicoAction(formData: FormData) {
  await assertMaster();
  const nome = String(formData.get("nome") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await criarQrCodeUnico(nome, slug || undefined);
  revalidatePath("/admin/configuracoes/qr-codes");
}

export async function updateQrCodeUnicoAction(id: string, formData: FormData) {
  await assertMaster();
  await atualizarQrCodeUnico(id, {
    nome: String(formData.get("nome") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    ativo: formData.get("ativo") === "on",
  });
  revalidatePath("/admin/configuracoes/qr-codes");
}

export async function toggleQrCodeUnicoAction(id: string, ativo: boolean) {
  await assertMaster();
  await atualizarQrCodeUnico(id, { ativo });
  revalidatePath("/admin/configuracoes/qr-codes");
}

export async function updateDestinoQrCodeAction(id: string, formData: FormData) {
  const u = await assertMaster();
  const tipoDestino = String(formData.get("tipo_destino") ?? "site") as QrCodeTipoDestino;
  const destinoUrl = String(formData.get("destino_url") ?? "").trim() || null;
  const destinoEventoId = String(formData.get("destino_evento_id") ?? "").trim() || null;
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  await atualizarDestinoQrCodeUnico({
    qrId: id,
    tipoDestino,
    destinoUrl,
    destinoEventoId,
    usuarioId: u.id,
    motivo,
  });

  revalidatePath("/admin/configuracoes/qr-codes");
}

export async function fetchHistoricoDestinosAction(qrId: string) {
  await assertMaster();
  return buscarHistoricoDestinosQrCode(qrId);
}

