export const TIPOS_CREDITO_PUBLICO = [
  "Imóvel",
  "Veículo",
  "Moto",
  "Caminhões e Frota",
  "Máquinas",
  "Serviços",
  "Outro",
] as const;

export type TipoCreditoPublico = (typeof TIPOS_CREDITO_PUBLICO)[number];
