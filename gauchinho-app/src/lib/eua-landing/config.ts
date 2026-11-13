import type { EuaContato } from "./types";

/** Série SGS do Banco Central: dólar comercial (venda), diário. */
export const BCB_SERIE_DOLAR_VENDA = 1;

/** Consultores indicados pela franquia para atendimento dos brasileiros nos EUA. */
export const EUA_CONTATOS: EuaContato[] = [
  { nome: "Fernando", whatsapp: "+55 (66) 99608-6030" },
  { nome: "Gauchinho", whatsapp: "+55 (66) 99912-6120" },
];

/** Ícone da franquia Gauchinho exibido na assinatura "Franqueado Gauchinho". */
export const EUA_ICONE_GAUCHINHO = "/foto/ICONE.svg";
