import type { GrupoConsorcio } from "@/lib/types";

export type CalcularPrazoGrupoInput = {
  prazoTotal: number | null | undefined;
  parcelasRealizadasBase: number | null | undefined;
  dataBaseParcelas: string | Date | null | undefined;
  atualizacaoAutomatica: boolean | null | undefined;
  parcelasRealizadasManual: number | null | undefined;
  prazoRestanteManual: number | null | undefined;
  dataReferencia?: Date;
};

export type PrazoGrupoCalculado = {
  prazoTotal: number;
  parcelasRealizadasAtuais: number;
  prazoRestanteAtual: number;
  modoAutomatico: boolean;
  dataBaseParcelas: string | null;
};

function num(v: number | null | undefined, fallback = 0): number {
  return v != null && Number.isFinite(v) ? v : fallback;
}

/** Normaliza para meia-noite UTC local (só calendário). */
export function parseDataCalendario(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y!, m! - 1, d);
  }
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  }
  const parsed = new Date(s);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Meses completos de ciclo mensal: só avança quando o dia da referência >= dia da base.
 * Ex.: base 16/06, ref 15/07 → 0; ref 16/07 → 1; ref 16/08 → 2.
 */
export function mesesDecorridosCicloMensal(
  dataBase: string | Date,
  dataReferencia: string | Date,
): number {
  const base = parseDataCalendario(dataBase);
  const ref = parseDataCalendario(dataReferencia);
  if (ref.getTime() < base.getTime()) return 0;

  let months =
    (ref.getFullYear() - base.getFullYear()) * 12 + (ref.getMonth() - base.getMonth());
  if (ref.getDate() < base.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatDataBr(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = parseDataCalendario(isoDate);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function calcularPrazoGrupo(input: CalcularPrazoGrupoInput): PrazoGrupoCalculado {
  const prazoTotal = Math.max(0, Math.floor(num(input.prazoTotal)));
  const dataRef = input.dataReferencia ?? new Date();
  const autoLigado = !!input.atualizacaoAutomatica;
  const dataBaseRaw = input.dataBaseParcelas;
  const baseParcelas =
    input.parcelasRealizadasBase != null
      ? Math.max(0, Math.floor(num(input.parcelasRealizadasBase)))
      : null;

  const podeAuto =
    autoLigado && dataBaseRaw != null && baseParcelas != null && prazoTotal > 0;

  if (podeAuto) {
    const meses = mesesDecorridosCicloMensal(dataBaseRaw, dataRef);
    const realizadas = Math.min(baseParcelas! + meses, prazoTotal);
    const restantes = Math.max(prazoTotal - realizadas, 0);
    const iso =
      typeof dataBaseRaw === "string"
        ? dataBaseRaw.slice(0, 10)
        : `${dataBaseRaw.getFullYear()}-${String(dataBaseRaw.getMonth() + 1).padStart(2, "0")}-${String(dataBaseRaw.getDate()).padStart(2, "0")}`;
    return {
      prazoTotal,
      parcelasRealizadasAtuais: realizadas,
      prazoRestanteAtual: restantes,
      modoAutomatico: true,
      dataBaseParcelas: iso,
    };
  }

  const realizadasManual = Math.max(0, Math.floor(num(input.parcelasRealizadasManual)));
  const restManual =
    input.prazoRestanteManual != null && Number.isFinite(input.prazoRestanteManual)
      ? Math.max(0, Math.floor(num(input.prazoRestanteManual)))
      : prazoTotal > 0
        ? Math.max(prazoTotal - realizadasManual, 0)
        : 0;

  return {
    prazoTotal,
    parcelasRealizadasAtuais: realizadasManual,
    prazoRestanteAtual: restManual,
    modoAutomatico: false,
    dataBaseParcelas: null,
  };
}

export function calcularPrazoGrupoFromRow(
  grupo: Pick<
    GrupoConsorcio,
    | "prazo_total"
    | "parcelas_realizadas"
    | "prazo_restante"
    | "parcelas_realizadas_base"
    | "data_base_parcelas"
    | "atualizacao_parcelas_automatica"
  >,
  dataReferencia?: Date,
): PrazoGrupoCalculado {
  return calcularPrazoGrupo({
    prazoTotal: grupo.prazo_total,
    parcelasRealizadasBase: grupo.parcelas_realizadas_base ?? grupo.parcelas_realizadas,
    dataBaseParcelas: grupo.data_base_parcelas,
    atualizacaoAutomatica: !!grupo.atualizacao_parcelas_automatica,
    parcelasRealizadasManual: grupo.parcelas_realizadas,
    prazoRestanteManual: grupo.prazo_restante,
    dataReferencia,
  });
}

export function tooltipPrazoAutomatico(
  grupo: Pick<
    GrupoConsorcio,
    | "prazo_total"
    | "parcelas_realizadas"
    | "prazo_restante"
    | "parcelas_realizadas_base"
    | "data_base_parcelas"
    | "atualizacao_parcelas_automatica"
  >,
): string | undefined {
  const p = calcularPrazoGrupoFromRow(grupo);
  if (!p.modoAutomatico || !p.dataBaseParcelas) return undefined;
  return `Atualizado automaticamente com base em ${formatDataBr(p.dataBaseParcelas)}.`;
}
