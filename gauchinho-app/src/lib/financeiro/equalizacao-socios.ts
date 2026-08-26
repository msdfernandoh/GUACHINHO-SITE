export type SocioEqualizacaoEntrada = {
  id: string;
  nome: string;
  percentual: number;
  pago: number;
};

export type SocioEqualizacao = SocioEqualizacaoEntrada & {
  responsabilidade: number;
  saldo: number;
};

export type InstrucaoEqualizacao = {
  devedorId: string;
  devedorNome: string;
  credorId: string;
  credorNome: string;
  valorTransferencia: number;
  valorContasAlternativo: number;
};

const centavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function calcularEqualizacaoSocios(socios: SocioEqualizacaoEntrada[]) {
  const totalPago = centavos(socios.reduce((total, socio) => total + Number(socio.pago || 0), 0));
  let responsabilidadeAcumulada = 0;
  const calculados: SocioEqualizacao[] = socios.map((socio, indice) => {
    const responsabilidade = indice === socios.length - 1
      ? centavos(totalPago - responsabilidadeAcumulada)
      : centavos(totalPago * Number(socio.percentual || 0) / 100);
    responsabilidadeAcumulada = centavos(responsabilidadeAcumulada + responsabilidade);
    return { ...socio, pago: centavos(socio.pago), responsabilidade, saldo: centavos(socio.pago - responsabilidade) };
  });

  const devedores = calculados.filter((socio) => socio.saldo < 0).map((socio) => ({ ...socio, restante: centavos(-socio.saldo) }));
  const credores = calculados.filter((socio) => socio.saldo > 0).map((socio) => ({ ...socio, restante: socio.saldo }));
  const instrucoes: InstrucaoEqualizacao[] = [];
  let indiceDevedor = 0;
  let indiceCredor = 0;
  while (indiceDevedor < devedores.length && indiceCredor < credores.length) {
    const devedor = devedores[indiceDevedor];
    const credor = credores[indiceCredor];
    const valor = centavos(Math.min(devedor.restante, credor.restante));
    if (valor > 0) {
      instrucoes.push({
        devedorId: devedor.id,
        devedorNome: devedor.nome,
        credorId: credor.id,
        credorNome: credor.nome,
        valorTransferencia: valor,
        valorContasAlternativo: centavos(valor / Math.max(1 - Number(devedor.percentual || 0) / 100, 0.000001)),
      });
    }
    devedor.restante = centavos(devedor.restante - valor);
    credor.restante = centavos(credor.restante - valor);
    if (devedor.restante === 0) indiceDevedor += 1;
    if (credor.restante === 0) indiceCredor += 1;
  }
  return { totalPago, socios: calculados, instrucoes };
}
