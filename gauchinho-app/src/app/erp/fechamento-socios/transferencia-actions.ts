"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { createClient } from "@/lib/supabase/server";
import { calcularFechamentoSocios } from "@/lib/gestao/fechamento-socios";
import { carregarPainelFechamento } from "./actions";

class ErroTransferencia extends Error {}

export type ResultadoTransferenciaSocio =
  | { ok: true; saldoSistema: number }
  | { ok: false; mensagem: string };

/** Validações esperadas são dados serializáveis, preservados no build de produção. */
export async function efetivarTransferenciaSocio(form: FormData): Promise<ResultadoTransferenciaSocio> {
  try {
    return { ok: true, ...await registrarTransferencia(form) };
  } catch (erro) {
    if (erro instanceof ErroTransferencia) return { ok: false, mensagem: erro.message };
    const referencia = randomUUID();
    console.error(`[transferencia-socio:${referencia}]`, erro);
    return { ok: false, mensagem: `Não foi possível concluir o registro. Atualize o painel para conferir antes de tentar novamente. Referência: ${referencia}` };
  }
}

/** Registra um PIX/TED já realizado, sem gerar nova baixa de comissão ou lacrar o período. */
async function registrarTransferencia(form: FormData): Promise<{ saldoSistema: number }> {
  const { empresaAtiva } = await requireErpRouteAccess("conta-corrente-socios");
  const { empresaAtiva: permitida } = await requireTenantPermission("gerenciar_financeiro");
  if (empresaAtiva.id !== permitida.id) throw new ErroTransferencia("Empresa ativa divergente.");
  const socioId = String(form.get("socio_id") || "");
  const valorTexto = String(form.get("valor") || "").trim();
  const comprovante = String(form.get("comprovante") || "").trim();
  const baseTexto = String(form.get("transferencias_base") || "");
  const inicio = String(form.get("inicio") || "");
  const valor = Number(valorTexto.replace(",", "."));
  const base = Number(baseTexto);
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(valorTexto) || !Number.isFinite(valor) || valor <= 0
    || !/^-?\d+(?:\.\d{1,2})?$/.test(baseTexto) || !Number.isFinite(base)
    || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || comprovante.length < 8 || form.get("confirmo_transferencia") !== "sim") {
    throw new ErroTransferencia("Informe valor positivo, comprovante e confirme a transferência já realizada no banco.");
  }
  const db = await createClient();
  const { data: socio, error: erroSocio } = await db.from("empresa_socios")
    .select("id,usuario_id,nome").eq("empresa_id", empresaAtiva.id).eq("id", socioId).eq("ativo", true).single();
  if (erroSocio || !socio?.usuario_id) throw new ErroTransferencia("Sócio ativo não encontrado nesta empresa.");
  const { data: participantes, error: erroParticipantes } = await db.from("participantes_comerciais")
    .select("id").eq("empresa_id", empresaAtiva.id).eq("usuario_id", socio.usuario_id);
  if (erroParticipantes) throw new ErroTransferencia("Não foi possível identificar a conta do sócio.");
  const ids = (participantes || []).map((item) => item.id);
  if (!ids.length) throw new ErroTransferencia("Cadastre o participante e a conta financeira deste sócio antes de transferir.");
  const { data: contas, error: erroContas } = await db.from("financeiro_contas_bancarias")
    .select("id").eq("empresa_id", empresaAtiva.id).eq("ativo", true).in("participante_comercial_id", ids);
  if (erroContas || contas?.length !== 1) throw new ErroTransferencia("O sócio precisa de uma única conta financeira ativa para receber a transferência.");
  const destinoId = contas[0].id;
  // Uma posição do sócio só pode gerar uma transferência por este fluxo, inclusive em abas concorrentes.
  const chave = `retirada-socio:${socioId}:${inicio}:${Math.round(base * 100)}`;
  const { data: anterior, error: erroAnterior } = await db.from("financeiro_transferencias_contas")
    .select("valor,conta_origem_id,conta_destino_id,comprovante_referencia").eq("empresa_id", empresaAtiva.id).eq("idempotency_key", chave).maybeSingle();
  if (erroAnterior) throw new ErroTransferencia("Não foi possível conferir transferências anteriores.");
  const painel = await carregarPainelFechamento();
  if (!painel.bancoEmpresa) throw new ErroTransferencia("Conta bancária da empresa não identificada.");
  if (anterior) {
    if (Number(anterior.valor) !== valor || anterior.conta_destino_id !== destinoId
      || anterior.conta_origem_id !== painel.bancoEmpresa.id || anterior.comprovante_referencia !== comprovante) {
      throw new ErroTransferencia("Já existe uma transferência para esta posição. Atualize o painel antes de registrar outra.");
    }
    revalidatePath("/erp/fechamento-socios");
    return { saldoSistema: painel.bancoEmpresa.saldoSistema };
  }
  const socioAtual = painel.socios.find((item) => item.id === socioId);
  if (!socioAtual || painel.inicio !== inicio || socioAtual.transferenciasRealizadas !== base) {
    throw new ErroTransferencia("A posição do sócio mudou. Atualize o painel antes de transferir.");
  }
  const calculoBase = { despesasPagas: painel.despesasPagas,
    lucroConsultores: painel.margemConsultores + painel.receitasEventos,
    reservaImpostos: painel.reservaImpostos, caixaAntes: painel.bancoEmpresa.saldoSistema,
    socios: painel.socios.map((item) => ({ ...item, retirada: 0 })) };
  const saldoSocio = calcularFechamentoSocios(calculoBase).socios.find((item) => item.id === socioId);
  if (Math.round(valor * 100) > Math.max(0, Math.round((saldoSocio?.direitoAntesRetirada ?? 0) * 100))) {
    throw new ErroTransferencia(`A retirada de ${socioAtual.nome} supera seu saldo positivo.`);
  }
  const posicao = calcularFechamentoSocios({ ...calculoBase,
    socios: calculoBase.socios.map((item) => ({ ...item, retirada: item.id === socioId ? valor : 0 })) });
  if (posicao.cobertura < 0 || posicao.caixaDepois < painel.reservaImpostos) {
    throw new ErroTransferencia("O caixa não cobre a retirada e os valores reservados, inclusive impostos.");
  }
  if (painel.bloqueios.length) throw new ErroTransferencia(`Concilie as pendências antes de efetivar: ${painel.bloqueios.join(" ")}`);
  const { data: resultado, error } = await db.rpc("rpc_transferir_entre_contas", {
    p_empresa_id: empresaAtiva.id, p_conta_origem_id: painel.bancoEmpresa.id,
    p_conta_destino_id: destinoId, p_valor: valor, p_data: painel.hoje,
    p_descricao: `Retirada de crédito do sócio ${socio.nome}`,
    p_comprovante: comprovante, p_idempotency_key: chave,
  });
  if (error) {
    // Detalhes SQL ficam no servidor; o cartão recebe uma orientação segura.
    console.error("[transferencia-socio:rpc]", error);
    throw new ErroTransferencia("A transferência não foi confirmada pelo sistema. Atualize o painel para conferir o saldo e as permissões antes de tentar novamente.");
  }
  // A RPC serializa pela conta de origem e pode reutilizar uma operação concorrente.
  const registrada = resultado?.transferencia;
  if (!registrada || Number(registrada.valor) !== valor || registrada.comprovante_referencia !== comprovante
    || registrada.conta_destino_id !== destinoId || registrada.conta_origem_id !== painel.bancoEmpresa.id) {
    throw new ErroTransferencia("Uma transferência concorrente já foi registrada. Atualize o painel para conferir.");
  }
  for (const rota of ["/erp/fechamento-socios", "/erp/financeiro", "/erp/conta-corrente-socios"]) revalidatePath(rota);
  const atualizado = await carregarPainelFechamento();
  return { saldoSistema: atualizado.bancoEmpresa?.saldoSistema ?? posicao.caixaDepois };
}
