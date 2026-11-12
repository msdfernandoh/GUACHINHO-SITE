import { calcularPedraPorLoteriaFederal } from "./assembleias";

// Registros conferidos cujo cálculo original usou uma quantidade padrão.
const cotasConferidas = new Map([
  ["13ba7f3a-0b60-4e3d-b5e1-f09e2b73067b", 700],
  ["33fb4405-4b83-4f91-b30c-6d753fdc1ed7", 3000],
  ["437fa49e-2902-4ffd-94b6-bff49ce96ac3", 500],
  ["450f84a9-6d67-415e-81b8-cfc12534b79d", 3000],
  ["49257111-c51f-49a8-82f2-a03ea1f36944", 3000],
  ["4b97d9f5-14cb-41f9-9779-65aae264c83b", 500],
  ["4ffb22ab-4272-41cf-89c0-9cf9390e4ef8", 900],
  ["5da1cfce-fff8-4536-92cb-7facb1bb5ca1", 3000],
  ["686afd7c-d5dc-40d3-add7-662935c7f49c", 900],
  ["80c3eeed-25cc-4feb-a5fc-ddbaf659f9ee", 700],
  ["86e201bc-b726-48d4-a4fc-ccbffcb37654", 1500],
  ["a214e78a-50d1-42fc-8b89-7128a68e9d77", 900],
  ["a2cfc72f-51d1-403e-a60c-c7eef7264d0a", 900],
  ["a2f1b69e-0032-421c-8c4a-5779cd431fd5", 999],
  ["af9bca15-79f3-4001-a853-3f06d9fe22f6", 700],
  ["bb547904-767d-40ac-b980-9438625fc158", 500],
  ["bc838963-bb10-4f3e-b3c9-b2f5a93be6f9", 5000],
  ["be61a218-0d5d-4efa-a845-78e469b97daa", 3000],
  ["be967ab3-8c80-42d1-b0e6-2f2b86846199", 3000],
  ["c8a50564-402e-4186-bfee-d2049cbe5405", 900],
  ["e6d1c3e8-a2bf-44bf-b67f-4c85e29f0430", 500],
  ["f83fdfa1-3fe8-40d3-af5a-7708f9bf610b", 500],
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
const cotasFederal = /^Loteria Federal \(1º Prêmio \d{5}\) · .*? \(([1-9]\d*) cotas\)/;

export function quantidadeCotasRegistrada(assembleia: PedraRegistrada): number | null {
  const total = assembleia.observacao?.match(cotasFederal)?.[1];
  return total ? Number(total) : null;
}

export function aplicarCorrecaoPedra<T extends PedraRegistrada>(assembleia: T): T {
  const cotas = cotasConferidas.get(assembleia.id);
  const premio = assembleia.observacao?.match(premioFederal)?.[1];
  if (cotas == null || !premio) return assembleia;
  return {
    ...assembleia,
    pedra_sorteada: calcularPedraPorLoteriaFederal(premio, cotas),
    observacao: assembleia.observacao?.replace(cotasFederal, (trecho) => trecho.replace(/\(\d+ cotas\)$/, `(${cotas} cotas)`)) ?? null,
  };
}

export function chaveEvento(assembleia: PedraRegistrada): string {
  const { data_assembleia, numero_assembleia, created_at, pedra_sorteada, observacao } = assembleia;
  const premio = observacao?.match(premioFederal)?.[1];
  return premio
    ? `${data_assembleia}:federal:${created_at}:${premio}:${numero_assembleia ?? ""}`
    : `${data_assembleia}:manual:${pedra_sorteada}:${numero_assembleia ?? ""}`;
}
