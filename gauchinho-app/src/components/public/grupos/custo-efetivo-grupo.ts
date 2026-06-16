"use client";

import type { GrupoConsorcio } from "@/lib/types";
import {
  calcularCustoEfetivoAnual,
  calcularCustoEfetivoMensal,
  formatarPercentualSimulador,
} from "@/lib/simulador/consorcio";

export function custoEfetivoAdministrativoGrupo(grupo: GrupoConsorcio): {
  mensal: number | null;
  anual: number | null;
} {
  const taxa = Number(grupo.taxa_administrativa_percentual) || 0;
  const prazo = Number(grupo.prazo_total) || 0;
  if (taxa <= 0 || prazo <= 0) {
    return { mensal: null, anual: null };
  }
  const mensal = calcularCustoEfetivoMensal(taxa, prazo);
  const anual = calcularCustoEfetivoAnual(mensal);
  return { mensal, anual };
}

export function formatCustoEfetivoMensal(grupo: GrupoConsorcio): string {
  const { mensal } = custoEfetivoAdministrativoGrupo(grupo);
  if (mensal == null) return "—";
  return `${formatarPercentualSimulador(mensal)} a.m.`;
}

export function formatCustoEfetivoAnual(grupo: GrupoConsorcio): string {
  const { anual } = custoEfetivoAdministrativoGrupo(grupo);
  if (anual == null) return "—";
  return `${formatarPercentualSimulador(anual)} a.a.`;
}
