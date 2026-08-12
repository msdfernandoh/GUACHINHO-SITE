export type CotaAssembleia = {
  id: string;
  numero_cota: string | null;
  cliente_nome: string;
  status: string;
};

export type CotaProxima = CotaAssembleia & {
  numero: number;
  distancia: number;
};

export function numeroCotaParaPedra(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const numero = Number(value);
  return Number.isSafeInteger(numero) && numero >= 0 ? numero : null;
}

export function ordenarCotasPorProximidade(cotas: CotaAssembleia[], pedra: number): CotaProxima[] {
  return cotas
    .flatMap((cota) => {
      const numero = numeroCotaParaPedra(cota.numero_cota);
      return numero == null ? [] : [{ ...cota, numero, distancia: Math.abs(numero - pedra) }];
    })
    .sort((a, b) => a.distancia - b.distancia || a.numero - b.numero || a.id.localeCompare(b.id));
}
