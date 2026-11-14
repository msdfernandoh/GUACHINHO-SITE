/** Evento serializado para os componentes cliente, com a data já formatada em Sinop. */
export type HerancaEventoView = {
  slug: string;
  nome: string;
  dataIso: string | null;
  /** Ex.: "quinta-feira, 27 de novembro, às 19h". */
  dataLabel: string | null;
  local: string | null;
  endereco: string | null;
  cidade: string | null;
  vagasRestantes: number | null;
  mapaUrl: string | null;
};
