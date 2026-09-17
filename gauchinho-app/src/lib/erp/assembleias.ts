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
  posicaoFila: "EXATA" | "SUPERIOR" | "GIRO";
  labelDiferenca: string;
};

export type GrupoItemRef = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora?: string | null;
  quantidade_cotas_sorteio?: number | null;
};

export type GrupoComCotasProximas = {
  grupoId: string;
  codigoGrupo: string;
  modalidade: string;
  administradora?: string | null;
  quantidadeCotas: number;
  assembleiaId?: string;
  pedraSorteada: number;
  cotas: CotaProxima[];
  menorDistancia: number | null;
  possuiContempladaPedra: boolean;
};

export function validarPrimeiroPremioFederal(primeiroPremio: string): boolean {
  return /^\d{5}$/.test(primeiroPremio.trim());
}

export function calcularPedraPorLoteriaFederal(
  primeiroPremio: string,
  quantidadeCotas: number,
): number {
  if (!validarPrimeiroPremioFederal(primeiroPremio)) {
    throw new Error("O 1º Prêmio da Loteria Federal deve conter exatamente 5 dígitos.");
  }
  const cotas = Math.floor(Number(quantidadeCotas));
  if (!Number.isSafeInteger(cotas) || cotas <= 0) {
    throw new Error("A quantidade de cotas deve ser um número inteiro maior que zero.");
  }
  return Number(primeiroPremio.trim()) % cotas;
}

export function numeroCotaParaPedra(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const numero = Number(value);
  return Number.isSafeInteger(numero) && numero >= 0 ? numero : null;
}

/**
 * Critério Oficial de Aproximação de Consórcios: "Sempre o número ou maior".
 * 1. Exata: cota === pedra -> distância 0
 * 2. Superior: cota > pedra -> distância (cota - pedra)
 * 3. Giro (wrap-around): cota < pedra -> distância (maxCotas - pedra) + cota
 */
export function calcularDistanciaPedra(
  numeroCota: number,
  pedra: number,
  quantidadeCotas: number = 999,
): { distancia: number; posicaoFila: "EXATA" | "SUPERIOR" | "GIRO"; labelDiferenca: string } {
  if (numeroCota === pedra) {
    return {
      distancia: 0,
      posicaoFila: "EXATA",
      labelDiferenca: "0 (Sorteada!)",
    };
  }

  if (numeroCota > pedra) {
    const dif = numeroCota - pedra;
    return {
      distancia: dif,
      posicaoFila: "SUPERIOR",
      labelDiferenca: `+${dif} (Superior)`,
    };
  }

  // Cota menor que a pedra: só é chamada após atingir o final do grupo (giro)
  const max = Math.max(quantidadeCotas, pedra, numeroCota);
  const difGiro = max - pedra + numeroCota;
  return {
    distancia: difGiro,
    posicaoFila: "GIRO",
    labelDiferenca: `+${difGiro} (Após giro)`,
  };
}

export function ordenarCotasPorProximidade(
  cotas: CotaAssembleia[],
  pedra: number,
  quantidadeCotas: number = 999,
): CotaProxima[] {
  return cotas
    .flatMap((cota) => {
      const numero = numeroCotaParaPedra(cota.numero_cota);
      if (numero == null) return [];
      const { distancia, posicaoFila, labelDiferenca } = calcularDistanciaPedra(
        numero,
        pedra,
        quantidadeCotas,
      );
      return [{ ...cota, numero, distancia, posicaoFila, labelDiferenca }];
    })
    .sort((a, b) => a.distancia - b.distancia || a.numero - b.numero || a.id.localeCompare(b.id));
}

export function agruparCotasPorGrupo(
  grupos: GrupoItemRef[],
  cotas: Array<CotaAssembleia & { grupo_id: string }>,
  pedraOuPadrao: number,
  assembleiaByGrupoId?: Map<string, string>,
  pedraPorGrupoId?: Map<string, number>,
): GrupoComCotasProximas[] {
  const cotasPorGrupo = new Map<string, Array<CotaAssembleia & { grupo_id: string }>>();
  for (const c of cotas) {
    const list = cotasPorGrupo.get(c.grupo_id) ?? [];
    list.push(c);
    cotasPorGrupo.set(c.grupo_id, list);
  }

  const resultado: GrupoComCotasProximas[] = grupos.map((g) => {
    const cotasDoGrupo = cotasPorGrupo.get(g.id) ?? [];
    const cotasMax =
      g.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
        ? Number(g.quantidade_cotas_sorteio)
        : g.modalidade?.toLowerCase().includes("imov")
        ? 999
        : 2000;

    const pedraDoGrupo = pedraPorGrupoId?.get(g.id) ?? pedraOuPadrao;
    const proximas = ordenarCotasPorProximidade(cotasDoGrupo, pedraDoGrupo, cotasMax);
    const menorDistancia = proximas.length > 0 ? proximas[0].distancia : null;
    const possuiContempladaPedra = proximas.some((c) => c.distancia === 0);

    return {
      grupoId: g.id,
      codigoGrupo: g.codigo_grupo,
      modalidade: g.modalidade,
      administradora: g.administradora ?? null,
      quantidadeCotas: cotasMax,
      assembleiaId: assembleiaByGrupoId?.get(g.id),
      pedraSorteada: pedraDoGrupo,
      cotas: proximas,
      menorDistancia,
      possuiContempladaPedra,
    };
  });

  // Ordena os grupos:
  // 1. Grupos com cota contemplada na pedra (distância 0)
  // 2. Grupos com cotas mais próximas (menorDistancia crescente)
  // 3. Grupos com cotas vs sem cotas
  // 4. Código do grupo
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


