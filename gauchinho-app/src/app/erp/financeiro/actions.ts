"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { parseBrazilianNumber } from "@/lib/utils/format";

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();
const valor = (formData: FormData) => parseBrazilianNumber(texto(formData, "valor"));
const hoje = () => new Date().toISOString().slice(0, 10);
const chave = (prefixo: string, formData: FormData) => `${prefixo}:${texto(formData, "operacao_id")}`;

export async function registrarMovimentoBancarioAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  const db = await createClient();
  const { error } = await db.rpc("rpc_registrar_movimento_bancario", {
    p_empresa_id: empresaAtiva.id,
    p_conta_id: texto(formData, "conta_id"),
    p_tipo: texto(formData, "tipo"),
    p_categoria: texto(formData, "categoria"),
    p_valor: valor(formData),
    p_data: texto(formData, "data") || hoje(),
    p_descricao: texto(formData, "descricao"),
    p_comprovante: texto(formData, "comprovante") || null,
    p_idempotency_key: chave("movimento-bancario", formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/financeiro");
  revalidatePath("/erp/contas-pagar");
}

export async function transferirEntreContasAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  const db = await createClient();
  const { error } = await db.rpc("rpc_transferir_entre_contas", {
    p_empresa_id: empresaAtiva.id,
    p_conta_origem_id: texto(formData, "conta_origem_id"),
    p_conta_destino_id: texto(formData, "conta_destino_id"),
    p_valor: valor(formData),
    p_data: texto(formData, "data") || hoje(),
    p_descricao: texto(formData, "descricao") || "Transferência entre contas da empresa",
    p_comprovante: texto(formData, "comprovante") || null,
    p_idempotency_key: chave("transferencia-contas", formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/financeiro");
}

export async function registrarTransferenciaSociosAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  const db = await createClient();
  const { error } = await db.rpc("rpc_registrar_transferencia_socios", {
    p_empresa_id: empresaAtiva.id,
    p_socio_origem_id: texto(formData, "socio_origem_id"),
    p_socio_destino_id: texto(formData, "socio_destino_id"),
    p_valor: valor(formData),
    p_data: texto(formData, "data") || hoje(),
    p_instrucao_id: texto(formData, "instrucao_id") || null,
    p_comprovante: texto(formData, "comprovante") || null,
    p_observacao: texto(formData, "observacao") || "Transferência para equalização societária",
    p_idempotency_key: chave("transferencia-socios", formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/financeiro");
  revalidatePath("/erp/contas-pagar");
}
