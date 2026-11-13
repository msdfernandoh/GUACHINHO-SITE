import type { EuaLang } from "./copy";

export type EuaOportunidade = {
  id: string;
  tipo: "imovel" | "carta";
  titulo: string;
  cidade: string | null;
  valor: number | null;
  entrada: number | null;
  fotoUrl: string | null;
  /** Tipo do bem da carta contemplada (imovel/veiculo/...). */
  tipoBem: string | null;
};

export type EuaContato = { nome: string; whatsapp: string };

export type EuaLandingProps = {
  initialLang: EuaLang;
  cambio: number;
  cambioData: string | null;
  oportunidades: EuaOportunidade[];
  contatos: EuaContato[];
  iconeGauchinhoUrl: string | null;
  /** Instante do servidor: agenda e ano renderizam igual no servidor e no cliente. */
  agoraIso: string;
};
