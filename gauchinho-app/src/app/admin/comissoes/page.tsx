import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { listPrevisoesFranquiaForEmpresa, listPrevisoesParticipantesForEmpresa } from "@/lib/comissoes/comissoes-service";
import { CompanyCommissionsDashboard, type CompanyCommissionLine, type ParticipantCommissionLine } from "@/components/erp/comissoes/company-commissions-dashboard";

const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export default async function AdminComissoesPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const empresaId = empresaAtiva.id;
  const db = await createClient();
  const [prevFranquia, prevParticipantes, importacoesRes, itensRepasseRes, participantesRes] = await Promise.all([
    listPrevisoesFranquiaForEmpresa(empresaId), listPrevisoesParticipantesForEmpresa(empresaId),
    db.from("erp_repasse_importacoes").select("id,administradora_id,competencia,arquivo_nome,status,created_at").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(100),
    db.from("erp_repasse_importacao_itens").select("previsao_franquia_id,previsao_sugerida_id,status_conciliacao,importacao:erp_repasse_importacoes!inner(arquivo_nome,created_at)").eq("empresa_id", empresaId).or("previsao_franquia_id.not.is.null,previsao_sugerida_id.not.is.null"),
    db.from("participantes_comerciais").select("id,nome,nome_exibicao,cargo,status").eq("empresa_id", empresaId).order("nome"),
  ]);
  if (importacoesRes.error || itensRepasseRes.error || participantesRes.error) throw new Error("Não foi possível carregar a conferência de comissões da empresa.");
  const relatoriosPorCompetencia = new Set((importacoesRes.data ?? []).map((item) => `${item.administradora_id}:${item.competencia}`));
  const vinculos = new Map<string, { status: string; arquivo: string }>();
  for (const row of itensRepasseRes.data ?? []) {
    const imp = relation(row.importacao as unknown as { arquivo_nome: string } | Array<{ arquivo_nome: string }> | null);
    for (const id of [row.previsao_franquia_id, row.previsao_sugerida_id]) if (id && !vinculos.has(id)) vinculos.set(id, { status: row.status_conciliacao, arquivo: imp?.arquivo_nome || "Relatório importado" });
  }
  const competenciaAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const linhas: CompanyCommissionLine[] = prevFranquia.map((item) => {
    const venda = relation(item.venda); const cota = relation(item.cota);
    const saldo = Math.max(0, Number(item.valor_previsto) - Number(item.valor_liquidado));
    const vinculo = vinculos.get(item.id); const relatorioImportado = relatoriosPorCompetencia.has(`${item.administradora_id}:${item.competencia}`);
    let situacao: CompanyCommissionLine["situacao"] = "aguardando";
    if (saldo <= 0) situacao = "recebido"; else if (vinculo) situacao = "atencao"; else if (relatorioImportado && item.competencia <= competenciaAtual) situacao = "ausente";
    return { id:item.id,vendaId:item.venda_id,cotaId:item.cota_definitiva_id,competencia:item.competencia,clienteNome:venda?.cliente_nome||"Cliente não identificado",numeroGrupo:cota?.numero_grupo||null,numeroCota:cota?.numero_cota||null,nomeEtapa:item.tipo_gatilho==="CONTEMPLACAO"?"Contemplação":item.nome_etapa,valorGerado:Number(item.valor_bruto??item.valor_previsto),valorPrevisto:Number(item.valor_previsto),valorLiquidado:Number(item.valor_liquidado),saldo,status:item.status,situacao,arquivoRelatorio:vinculo?.arquivo };
  });
  const todosParticipantes = (participantesRes.data ?? []).map((item) => ({ id:item.id,nome:item.nome_exibicao||item.nome,cargo:item.cargo||null,status:item.status }));
  const participantes = todosParticipantes.filter((item) => item.status?.toLowerCase() === "ativo").map(({ id,nome,cargo }) => ({ id,nome,cargo }));
  const participanteMap = new Map(todosParticipantes.map((item) => [item.id,item]));
  const linhaPorVendaCota = new Map(linhas.map((item) => [`${item.vendaId}:${item.cotaId??""}`,item])); const linhaPorVenda = new Map(linhas.map((item) => [item.vendaId,item]));
  const pagamentos: ParticipantCommissionLine[] = prevParticipantes.map((item) => { const comercial=item.participante_comercial_id?participanteMap.get(item.participante_comercial_id):null; const origem=linhaPorVendaCota.get(`${item.venda_id}:${item.cota_definitiva_id??""}`)??linhaPorVenda.get(item.venda_id); return { id:item.id,participanteId:item.participante_comercial_id,participanteNome:comercial?.nome||"Participante não identificado",participanteCargo:comercial?.cargo||null,competencia:item.competencia,nomeEtapa:item.nome_etapa,clienteNome:origem?.clienteNome||"Venda sem cliente identificado",numeroGrupo:origem?.numeroGrupo||null,numeroCota:origem?.numeroCota||null,valorGerado:Number(item.valor_previsto),valorElegivel:Number(item.valor_elegivel),valorPago:Number(item.valor_pago) }; });
  return <CompanyCommissionsDashboard empresaNome={empresaAtiva.nome_fantasia??empresaAtiva.razao_social??"Consórcios"} competenciaAtual={competenciaAtual} linhas={linhas} pagamentos={pagamentos} participantes={participantes} />;
}
