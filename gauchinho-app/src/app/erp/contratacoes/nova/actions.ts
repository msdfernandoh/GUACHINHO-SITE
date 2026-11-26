"use server";

import { unstable_rethrow } from "next/navigation";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { iniciarNovaCotaClienteAction } from "../../clientes/actions";

export async function iniciarContratacaoAction(_estado: { erro: string }, formData: FormData) {
  try {
    await requireErpRouteAccess("contratacoes");
    await iniciarNovaCotaClienteAction(formData);
    return { erro: "Não foi possível iniciar a contratação." };
  } catch (error) {
    unstable_rethrow(error);
    return { erro: error instanceof Error ? error.message : "Não foi possível iniciar a contratação." };
  }
}
