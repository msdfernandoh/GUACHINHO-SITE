export type SocioFechamentoEntrada = {
  id: string;
  nome: string;
  percentual: number;
  comissaoGuardada: number;
  adiantamentoPessoal: number;
  saldoAnterior: number;
  retirada: number;
};

export type FechamentoCalculado = {
  despesasPagas: number;
  lucroConsultores: number;
  lucroUsadoNasDespesas: number;
  lucroRestanteNaEmpresa: number;
  despesasDivididas: number;
  reservaImpostos: number;
  caixaAntes: number;
  caixaDepois: number;
  totalRetirado: number;
  totalDeixadoPelosSocios: number;
  cobertura: number;
  socios: Array<SocioFechamentoEntrada & {
    parteDespesas: number;
    direitoAntesRetirada: number;
    ficouNaEmpresa: number;
    faltaCobrir: number;
  }>;
};

const cents = (valor: number) => Math.round(valor * 100);
const reais = (valor: number) => valor / 100;

export function calcularFechamentoSocios(input: {
  despesasPagas: number;
  lucroConsultores: number;
  reservaImpostos: number;
  caixaAntes: number;
  socios: SocioFechamentoEntrada[];
}): FechamentoCalculado {
  const numeros = [input.despesasPagas, input.lucroConsultores, input.reservaImpostos, input.caixaAntes,
    ...input.socios.flatMap((socio) => [socio.percentual, socio.comissaoGuardada,
      socio.adiantamentoPessoal, socio.saldoAnterior, socio.retirada])];
  if (numeros.some((numero) => !Number.isFinite(numero))) throw new Error("Há valor inválido no fechamento.");
  if (input.socios.length < 2 || Math.abs(input.socios.reduce((soma, socio) => soma + socio.percentual, 0) - 100) > 0.0001) {
    throw new Error("O quadro societário deve somar 100%.");
  }
  if ([input.despesasPagas, input.lucroConsultores, input.reservaImpostos, input.caixaAntes].some((n) => n < 0)) {
    throw new Error("Despesas, lucro, impostos e caixa não podem ser negativos.");
  }
  const despesas = cents(input.despesasPagas);
  const lucro = cents(input.lucroConsultores);
  const lucroUsado = Math.min(despesas, lucro);
  const base = despesas - lucroUsado;
  let rateado = 0;
  const socios = input.socios.map((socio, indice) => {
    if (socio.percentual <= 0 || socio.comissaoGuardada < 0 || socio.adiantamentoPessoal < 0 || socio.retirada < 0) {
      throw new Error(`Revise os valores de ${socio.nome}.`);
    }
    const parte = indice === input.socios.length - 1 ? base - rateado : Math.round(base * socio.percentual / 100);
    rateado += parte;
    const direito = cents(socio.saldoAnterior) + cents(socio.comissaoGuardada) + cents(socio.adiantamentoPessoal) - parte;
    const retirada = cents(socio.retirada);
    if (retirada > Math.max(0, direito)) throw new Error(`A retirada de ${socio.nome} supera seu saldo positivo.`);
    return {
      ...socio,
      parteDespesas: reais(parte),
      direitoAntesRetirada: reais(direito),
      ficouNaEmpresa: reais(Math.max(0, direito) - retirada),
      faltaCobrir: reais(Math.max(0, -direito)),
    };
  });
  const totalRetirado = socios.reduce((soma, socio) => soma + cents(socio.retirada), 0);
  const caixaDepois = cents(input.caixaAntes) - totalRetirado;
  const totalDeixado = socios.reduce((soma, socio) => soma + cents(socio.ficouNaEmpresa), 0);
  const lucroRestante = lucro - lucroUsado;
  const cobertura = caixaDepois - cents(input.reservaImpostos) - lucroRestante - totalDeixado;
  return {
    despesasPagas: reais(despesas),
    lucroConsultores: reais(lucro),
    lucroUsadoNasDespesas: reais(lucroUsado),
    lucroRestanteNaEmpresa: reais(lucroRestante),
    despesasDivididas: reais(base),
    reservaImpostos: input.reservaImpostos,
    caixaAntes: input.caixaAntes,
    caixaDepois: reais(caixaDepois),
    totalRetirado: reais(totalRetirado),
    totalDeixadoPelosSocios: reais(totalDeixado),
    cobertura: reais(cobertura),
    socios,
  };
}
