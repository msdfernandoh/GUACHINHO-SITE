export type CelulaPlanilha = string | number | boolean | Date | null;

export type ClienteLegadoLinha = {
  linha: number;
  cliente_nome: string;
  cpf_cnpj: string;
  telefone: string;
  administradora: string;
  bem: string;
  data_contrato: string;
  grupo: string;
  cota: string;
  valor_credito: number;
};

export type DiagnosticoClienteLegado = ClienteLegadoLinha & {
  pendencias: string[];
  erros: string[];
  grupo_encontrado: boolean;
  duplicada: boolean;
  previsoes_futuras: number;
};

const semAcentos = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const chave = (value: CelulaPlanilha) => semAcentos(String(value ?? "")).toLowerCase().replace(/[^a-z0-9]/g, "");
const texto = (value: CelulaPlanilha) => String(value ?? "").trim();
const digitos = (value: CelulaPlanilha) => texto(value).replace(/\D/g, "");

function dataIso(value: CelulaPlanilha): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  const raw = texto(value);
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function moeda(value: CelulaPlanilha): number {
  if (typeof value === "number") return Number(value.toFixed(2));
  const raw = texto(value).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

export function parseClientesLegado(rows: CelulaPlanilha[][]): { linhas: ClienteLegadoLinha[]; erros: string[] } {
  if (rows.length < 2) return { linhas: [], erros: ["A planilha não possui registros."] };
  const headers = rows[0].map(chave);
  const aliases: Record<keyof Omit<ClienteLegadoLinha, "linha">, string[]> = {
    cliente_nome: ["cliente", "nome", "razaosocial"],
    cpf_cnpj: ["cpfcnpj", "cpf", "cnpj"],
    telefone: ["contato", "telefone", "celular", "whatsapp"],
    administradora: ["administradora"],
    bem: ["bem", "segmento", "tipo"],
    data_contrato: ["datacontrato", "contrato", "datadavenda"],
    grupo: ["grupo", "numerogrupo"],
    cota: ["cota", "numerocota"],
    valor_credito: ["valor", "valorcredito", "credito"],
  };
  const indices = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex((h) => names.includes(h))])) as Record<keyof Omit<ClienteLegadoLinha, "linha">, number>;
  const obrigatorios = ["cliente_nome", "administradora", "bem", "data_contrato", "grupo", "cota", "valor_credito"] as const;
  const ausentes = obrigatorios.filter((field) => indices[field] < 0);
  if (ausentes.length) return { linhas: [], erros: [`Colunas obrigatórias ausentes: ${ausentes.join(", ")}.`] };

  const linhas = rows.slice(1).map((row, index): ClienteLegadoLinha | null => {
    if (row.every((cell) => texto(cell) === "")) return null;
    return {
      linha: index + 2,
      cliente_nome: texto(row[indices.cliente_nome]),
      cpf_cnpj: indices.cpf_cnpj >= 0 ? digitos(row[indices.cpf_cnpj]) : "",
      telefone: indices.telefone >= 0 ? digitos(row[indices.telefone]) : "",
      administradora: texto(row[indices.administradora]),
      bem: texto(row[indices.bem]),
      data_contrato: dataIso(row[indices.data_contrato]),
      grupo: texto(row[indices.grupo]),
      cota: texto(row[indices.cota]),
      valor_credito: moeda(row[indices.valor_credito]),
    };
  }).filter((item): item is ClienteLegadoLinha => item !== null);
  return { linhas, erros: [] };
}

export function dataParcelaLegado(dataContrato: string, numeroParcela: number): string {
  const [ano, mes, dia] = dataContrato.split("-").map(Number);
  if (!ano || !mes || !dia || numeroParcela < 1) return "";
  if (numeroParcela === 1) return dataContrato;
  const deslocamento = numeroParcela - (dia <= 10 ? 1 : 0);
  const data = new Date(Date.UTC(ano, mes - 1 + deslocamento, 10));
  return data.toISOString().slice(0, 10);
}
