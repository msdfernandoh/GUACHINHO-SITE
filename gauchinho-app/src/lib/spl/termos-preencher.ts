/** Preenchimento dos termos (roda no servidor e no navegador, sem dependências). */

export const MODELOS_COM_TERMO = ["GERADOR_OPORTUNIDADES", "GERADOR_NEGOCIOS", "MICROFRANQUIA"] as const;
export type ModeloComTermo = (typeof MODELOS_COM_TERMO)[number];

export const CAMPOS_TERMO = [
  { chave: "contratante_razao_social", rotulo: "Razão social da contratante (vazio = cadastro da empresa)" },
  { chave: "contratante_cnpj", rotulo: "CNPJ da contratante (vazio = cadastro da empresa)" },
  { chave: "contratante_sede", rotulo: "Sede da contratante (vazio = cadastro da empresa)" },
  { chave: "contratante_representante", rotulo: "Representante da contratante (nome e CPF)" },
  { chave: "vigencia_meses", rotulo: "Vigência inicial (meses)" },
  { chave: "aviso_previo_dias", rotulo: "Aviso prévio para rescisão (dias)" },
  { chave: "foro", rotulo: "Foro (cidade/UF)" },
  { chave: "prazo_estorno_dias", rotulo: "Prazo para devolver estorno sem saldo (dias)" },
  { chave: "multa_sigilo", rotulo: "Multa por quebra de sigilo/desvio (R$ ou %)" },
  { chave: "periodicidade_contas", rotulo: "Periodicidade da prestação de contas" },
  { chave: "canal_contestacao", rotulo: "Canal oficial para contestação financeira" },
] as const;

export type CamposTermo = Partial<Record<(typeof CAMPOS_TERMO)[number]["chave"], string>>;

export type ContratanteTermo = { razao_social: string; cnpj: string | null; sede: string; cidade: string };

export type ParticipanteTermo = {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  email: string;
  telefone: string;
  responsavel: string;
};

const A_DEFINIR = "[a definir]";
const NAO_INFORMADO = "não informado";

export function formatarCnpj(c: string | null | undefined): string {
  const d = String(c ?? "").replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : "";
}

export function formatarTelefone(t: string | null | undefined): string {
  const d = String(t ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Troca os {{campos}} pelos dados do cadastro, da contratante e do aceite. */
export function preencherTermo(
  modelo: string,
  args: { contratante: ContratanteTermo; participante: ParticipanteTermo | null; campos: CamposTermo; dataAceite?: string | null },
): string {
  const { contratante, participante: p, campos } = args;
  const v = (x: string | null | undefined, padrao: string) => (x && String(x).trim() ? String(x).trim() : padrao);
  const valores: Record<string, string> = {
    contratante_razao_social: v(campos.contratante_razao_social, v(contratante.razao_social, A_DEFINIR)),
    contratante_cnpj: v(campos.contratante_cnpj, v(formatarCnpj(contratante.cnpj), A_DEFINIR)),
    contratante_sede: v(campos.contratante_sede, v(contratante.sede, A_DEFINIR)),
    cidade_contratante: v(contratante.cidade, A_DEFINIR),
    participante_nome: v(p?.nome, "[nome da imobiliária]"),
    participante_documento: v(formatarCnpj(p?.cnpj), NAO_INFORMADO),
    participante_endereco: v(p?.endereco, NAO_INFORMADO),
    participante_email: v(p?.email, "[e-mail]"),
    participante_telefone: v(formatarTelefone(p?.telefone), "[telefone]"),
    participante_representante: v(p?.responsavel, "[responsável]"),
    data_aceite: args.dataAceite
      ? new Date(args.dataAceite).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba", day: "numeric", month: "long", year: "numeric" })
      : "data do aceite eletrônico",
    foro: v(campos.foro, v(contratante.cidade, A_DEFINIR)),
  };
  for (const c of CAMPOS_TERMO) if (!(c.chave in valores)) valores[c.chave] = v(campos[c.chave], A_DEFINIR);
  return modelo.replace(/\{\{(\w+)\}\}/g, (m, k: string) => valores[k] ?? m);
}
