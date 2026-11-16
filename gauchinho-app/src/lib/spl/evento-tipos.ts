/** Tipos e opções do check-in SPL no evento (seguros para o client). */

export const FLUXO_CHECKIN_SPL = "spl_imobiliarias" as const;

/** Meta incentivada de clientes por corretor (não obrigatória). */
export const META_CLIENTES_EVENTO = 5;

export const FUNCOES_CORRETOR = [
  { value: "COLABORADOR", label: "Colaborador", descricao: "Sou corretor ou faço parte da equipe" },
  { value: "PROPRIETARIO", label: "Proprietário", descricao: "Sou dono ou sócio da imobiliária" },
] as const;
export type FuncaoCorretor = (typeof FUNCOES_CORRETOR)[number]["value"];

export const OPCOES_DESAFIO = [
  { id: "imovel_100k", titulo: "Crédito imóvel", credito: 100_000, parcela: 375, prazo: 200, tipo: "imovel" },
  { id: "imovel_200k", titulo: "Crédito imóvel", credito: 200_000, parcela: 750, prazo: 200, tipo: "imovel" },
  { id: "imovel_spl_200k", titulo: "Imóvel · Grupo SPL", credito: 200_000, parcela: 1076, prazo: 159, tipo: "imovel" },
  { id: "veiculo_104k", titulo: "Crédito veículo", credito: 104_000, parcela: 604.5, prazo: 104, tipo: "veiculo" },
] as const;
export type DesafioId = (typeof OPCOES_DESAFIO)[number]["id"] | "sem_interesse";

export const DESAFIO_SEM_INTERESSE = { id: "sem_interesse", titulo: "No momento não tenho interesse" } as const;

export function descreverDesafio(id: string | null | undefined): string {
  if (id === "sem_interesse") return DESAFIO_SEM_INTERESSE.titulo;
  const o = OPCOES_DESAFIO.find((d) => d.id === id);
  if (!o) return "—";
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${o.titulo} ${brl(o.credito)} · parcela ${brl(o.parcela)} · ${o.prazo} parcelas`;
}

export type ImobiliariaOpcao = { id: string; nome: string; cadastroCompleto: boolean };

export type ClienteEvento = {
  id: string;
  nome: string;
  telefone: string;
  empreendimento: string | null;
  cupom: string | null;
};

export type SessaoCorretor = {
  participanteId: string;
  telefone: string;
  nome: string;
  cupomPresenca: string;
  imobiliariaId: string;
  imobiliariaNome: string;
  funcao: FuncaoCorretor;
  precisaDadosImobiliaria: boolean;
  clientes: ClienteEvento[];
  jaConcluiu: boolean;
};
