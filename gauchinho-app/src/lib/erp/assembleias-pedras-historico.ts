import { calcularPedraPorLoteriaFederal } from "./assembleias";

// Registros conferidos cujo cálculo original usou 2.000 cotas por padrão.
const cotasConferidas = new Map([
  ["4ffb22ab-4272-41cf-89c0-9cf9390e4ef8", 900],
  ["13ba7f3a-0b60-4e3d-b5e1-f09e2b73067b", 700],
  ["4b97d9f5-14cb-41f9-9779-65aae264c83b", 500],
  ["af9bca15-79f3-4001-a853-3f06d9fe22f6", 700],
  ["f83fdfa1-3fe8-40d3-af5a-7708f9bf610b", 500],
  ["80c3eeed-25cc-4feb-a5fc-ddbaf659f9ee", 700],
  ["bb547904-767d-40ac-b980-9438625fc158", 500],
]);

type PedraRegistrada = {
  id: string;
  data_assembleia: string;
  numero_assembleia: number | null;
  created_at: string;
  pedra_sorteada: number;
  observacao: string | null;
};

const premioFederal = /^Loteria Federal \(1º Prêmio (\d{5})\)/;

export function aplicarCorrecaoPedra<T extends PedraRegistrada>(assembleia: T): T {
  const cotas = cotasConferidas.get(assembleia.id);
  const premio = assembleia.observacao?.match(premioFederal)?.[1];
  if (cotas == null || !premio) return assembleia;
  return {
    ...assembleia,
    pedra_sorteada: calcularPedraPorLoteriaFederal(premio, cotas),
    observacao: assembleia.observacao?.replace("(2000 cotas)", `(${cotas} cotas)`) ?? null,
  };
}

export function chaveEvento(assembleia: PedraRegistrada): string {
  const { data_assembleia, numero_assembleia, created_at, pedra_sorteada, observacao } = assembleia;
  const premio = observacao?.match(premioFederal)?.[1];
  return premio
    ? `${data_assembleia}:federal:${created_at}:${premio}:${numero_assembleia ?? ""}`
    : `${data_assembleia}:manual:${pedra_sorteada}:${numero_assembleia ?? ""}`;
}
