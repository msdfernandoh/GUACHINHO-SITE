"use server";

import { revalidatePath } from "next/cache";
import { requireGerenciarAdministradorasEmpresa } from "@/lib/administradoras/authorization";
import {
  getEmpresaAdministradorasForSuperadmin,
  grantAdministradoraToEmpresa,
  listAdministradorasCandidatasParaEmpresa,
  setEmpresaAdministradoraStatus,
  updateEmpresaAdministradora,
} from "@/lib/administradoras/concessoes";
import type { EmpresaAdministradoraStatus } from "@/lib/administradoras/types";

function revalidateEmpresa(empresaId: string) {
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${empresaId}`);
}

export async function fetchEmpresaAdministradorasAction(empresaId: string) {
  await requireGerenciarAdministradorasEmpresa();
  return getEmpresaAdministradorasForSuperadmin(empresaId);
}

export async function fetchAdministradorasCandidatasAction(empresaId: string) {
  await requireGerenciarAdministradorasEmpresa();
  return listAdministradorasCandidatasParaEmpresa(empresaId);
}

export async function grantAdministradoraAction(empresaId: string, formData: FormData) {
  await requireGerenciarAdministradorasEmpresa();
  const administradoraId = String(formData.get("administradora_id") ?? "").trim();
  await grantAdministradoraToEmpresa({
    empresaId,
    administradoraId,
    status: "ATIVA",
    local: {
      codigo_franquia: String(formData.get("codigo_franquia") ?? ""),
      codigo_comercial: String(formData.get("codigo_comercial") ?? ""),
      contato_interno: String(formData.get("contato_interno") ?? ""),
      observacoes: String(formData.get("observacoes") ?? ""),
    },
  });
  revalidateEmpresa(empresaId);
}

export async function updateEmpresaAdministradoraAction(vinculoId: string, empresaId: string, formData: FormData) {
  await requireGerenciarAdministradorasEmpresa();
  await updateEmpresaAdministradora(vinculoId, {
    codigo_franquia: String(formData.get("codigo_franquia") ?? ""),
    codigo_comercial: String(formData.get("codigo_comercial") ?? ""),
    contato_interno: String(formData.get("contato_interno") ?? ""),
    observacoes: String(formData.get("observacoes") ?? ""),
  });
  revalidateEmpresa(empresaId);
}

export async function setEmpresaAdministradoraStatusAction(
  vinculoId: string,
  empresaId: string,
  status: EmpresaAdministradoraStatus,
) {
  await requireGerenciarAdministradorasEmpresa();
  await setEmpresaAdministradoraStatus(vinculoId, status);
  revalidateEmpresa(empresaId);
}
