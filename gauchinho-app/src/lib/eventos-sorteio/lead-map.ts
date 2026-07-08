import type { TipoSonhoSorteio } from "./types";

const MAP_TIPO_CREDITO: Record<TipoSonhoSorteio, string> = {
  Moto: "Moto",
  Carro: "Veículo",
  Casa: "Imóvel",
  Terreno: "Imóvel",
  Frota: "Caminhões e Frota",
};

export function tipoSonhoParaCreditoLead(tipo: TipoSonhoSorteio): string {
  return MAP_TIPO_CREDITO[tipo];
}

export function isTipoSonhoSorteio(value: string): value is TipoSonhoSorteio {
  return value in MAP_TIPO_CREDITO;
}
