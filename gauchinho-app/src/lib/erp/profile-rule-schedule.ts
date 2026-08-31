import type { CommissionStage } from "./commission-rule-input";

export function distributeProfileSchedule(count: number, total = 100): CommissionStage[] {
  if (!Number.isInteger(count) || count < 1 || count > 360 || !Number.isFinite(total) || total <= 0) {
    throw new Error("Informe de 1 a 360 parcelas e um total positivo.");
  }
  const units = Math.round(total * 100);
  const each = Math.floor(units / count);
  if (each < 1) throw new Error("O total é insuficiente para a quantidade de parcelas.");
  return Array.from({ length: count }, (_, i) => ({
    ordem: i + 1,
    tipo_gatilho: "MES_RELATIVO",
    mes_relativo: i + 1,
    nome: count === 1 ? "Pagamento único" : `Parcela ${i + 1}`,
    percentual_etapa: (each + (i === count - 1 ? units - each * count : 0)) / 100,
  }));
}

export function parseProfileSchedule(form: FormData, fixedTotal: number | null): CommissionStage[] {
  if (form.get("seguir_cronograma_franquia") === "true") return [];
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("etapas_cronograma") ?? "")); }
  catch { throw new Error("Informe o cronograma próprio de pagamento."); }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 360) {
    throw new Error("Informe de 1 a 360 parcelas.");
  }
  if (form.has("numero_parcelas") && Number(form.get("numero_parcelas")) !== raw.length) {
    throw new Error("Clique em Distribuir igualmente para aplicar a nova quantidade de parcelas.");
  }
  const fixed = fixedTotal !== null;
  const months = new Set<number>();
  const stages = raw.map((item: unknown, i): CommissionStage => {
    if (!item || typeof item !== "object") throw new Error("Parcela inválida.");
    const row = item as Record<string, unknown>;
    const month = Number(row.mes_relativo);
    const value = Number(fixed ? row.valor_etapa : row.percentual_etapa);
    if (!Number.isInteger(month) || month < 1 || months.has(month)) {
      throw new Error("Os meses das parcelas devem ser inteiros positivos e não podem se repetir.");
    }
    if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) {
      throw new Error("Informe valores positivos com até duas casas decimais nas parcelas.");
    }
    months.add(month);
    return {
      ordem: i + 1, tipo_gatilho: "MES_RELATIVO", mes_relativo: month,
      nome: String(row.nome ?? "").trim() || `Parcela ${i + 1}`,
      ...(fixed ? { valor_etapa: value } : { percentual_etapa: value }),
    };
  });
  const total = stages.reduce((sum, row) => sum + Math.round((row.valor_etapa ?? row.percentual_etapa ?? 0) * 100), 0);
  if (total !== Math.round((fixedTotal ?? 100) * 100)) {
    throw new Error(fixed ? "A soma das parcelas deve ser igual ao valor fixo total." : "A soma das parcelas deve fechar 100% da comissão do perfil.");
  }
  return stages.sort((a, b) => a.mes_relativo! - b.mes_relativo!).map((row, i) => ({ ...row, ordem: i + 1 }));
}
