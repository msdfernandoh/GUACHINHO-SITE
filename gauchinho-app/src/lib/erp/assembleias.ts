export type CotaAssembleia = {
  id: string;
  numero_cota: string | null;
  cliente_nome: string;
  status: string;
  grupo_id?: string;
  numero_grupo?: string;
  modalidade?: string;
};

export type CotaProxima = CotaAssembleia & {
  numero: number;
  distancia: number;
};

export type GrupoItemRef = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora?: string | null;
};

export type GrupoComCotasProximas = {
  grupoId: string;
  codigoGrupo: string;
  modalidade: string;
  administradora?: string | null;
  assembleiaId?: string;
  pedraSorteada: number;
  cotas: CotaProxima[];
  menorDistancia: number | null;
  possuiContempladaPedra: boolean;
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

export function agruparCotasPorGrupo(
  grupos: GrupoItemRef[],
  cotas: Array<CotaAssembleia & { grupo_id: string }>,
  pedra: number,
  assembleiaByGrupoId?: Map<string, string>,
): GrupoComCotasProximas[] {
  const cotasPorGrupo = new Map<string, Array<CotaAssembleia & { grupo_id: string }>>();
  for (const c of cotas) {
    const list = cotasPorGrupo.get(c.grupo_id) ?? [];
    list.push(c);
    cotasPorGrupo.set(c.grupo_id, list);
  }

  const resultado: GrupoComCotasProximas[] = grupos.map((g) => {
    const cotasDoGrupo = cotasPorGrupo.get(g.id) ?? [];
    const proximas = ordenarCotasPorProximidade(cotasDoGrupo, pedra);
    const menorDistancia = proximas.length > 0 ? proximas[0].distancia : null;
    const possuiContempladaPedra = proximas.some((c) => c.distancia === 0);

    return {
      grupoId: g.id,
      codigoGrupo: g.codigo_grupo,
      modalidade: g.modalidade,
      administradora: g.administradora ?? null,
      assembleiaId: assembleiaByGrupoId?.get(g.id),
      pedraSorteada: pedra,
      cotas: proximas,
      menorDistancia,
      possuiContempladaPedra,
    };
  });

  // Ordena os grupos:
  // 1. Grupos que têm cotas sorteadas na pedra (distancia 0)
  // 2. Grupos com cotas mais próximas (menorDistancia crescente)
  // 3. Grupos com cotas vs sem cotas
  // 4. Código do grupo alfanumérico
  return resultado.sort((a, b) => {
    const hasCotasA = a.cotas.length > 0;
    const hasCotasB = b.cotas.length > 0;
    if (hasCotasA && !hasCotasB) return -1;
    if (!hasCotasA && hasCotasB) return 1;

    if (a.menorDistancia != null && b.menorDistancia != null) {
      if (a.menorDistancia !== b.menorDistancia) {
        return a.menorDistancia - b.menorDistancia;
      }
    }

    return a.codigoGrupo.localeCompare(b.codigoGrupo, undefined, { numeric: true });
  });
}

