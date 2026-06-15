/** Grupos de demonstração — idempotentes por `codigo_grupo`. */
export type GrupoTesteDef = {
  codigo_grupo: string;
  modalidade: string;
  taxa_administrativa_percentual: number;
  fundo_reserva_percentual: number;
  seguro_habilitado: boolean;
  seguro_percentual: number;
  tem_parcela_reduzida: boolean;
  percentual_parcela_reduzida: number;
  permite_lance_embutido: boolean;
  percentual_lance_embutido: number;
  percentual_recurso_proprio_sugerido: number;
  prazo_total: number;
  parcelas_realizadas: number;
  prazo_restante: number;
  seguro_pos_contemplacao: boolean;
  cet_percentual: number;
  status: string;
  creditos: number[];
};

export const GRUPOS_TESTE_CODIGOS = [
  "1203",
  "1283",
  "1443",
  "1533",
  "2045",
  "3012",
] as const;

export const GRUPOS_TESTE: GrupoTesteDef[] = [
  {
    codigo_grupo: "1203",
    modalidade: "Imóvel",
    taxa_administrativa_percentual: 24,
    fundo_reserva_percentual: 2,
    seguro_habilitado: true,
    seguro_percentual: 0.038,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 50,
    permite_lance_embutido: true,
    percentual_lance_embutido: 40,
    percentual_recurso_proprio_sugerido: 5,
    prazo_total: 200,
    parcelas_realizadas: 72,
    prazo_restante: 128,
    seguro_pos_contemplacao: false,
    cet_percentual: 12.4,
    status: "Disponível",
    creditos: [85000, 95000, 110000, 135000],
  },
  {
    codigo_grupo: "1283",
    modalidade: "Imóvel",
    taxa_administrativa_percentual: 25,
    fundo_reserva_percentual: 2,
    seguro_habilitado: true,
    seguro_percentual: 0.038,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 50,
    permite_lance_embutido: true,
    percentual_lance_embutido: 35,
    percentual_recurso_proprio_sugerido: 5,
    prazo_total: 180,
    parcelas_realizadas: 60,
    prazo_restante: 120,
    seguro_pos_contemplacao: true,
    cet_percentual: 12.8,
    status: "Disponível",
    creditos: [180000, 220000, 250000, 320000],
  },
  {
    codigo_grupo: "1443",
    modalidade: "Imóvel",
    taxa_administrativa_percentual: 25,
    fundo_reserva_percentual: 2,
    seguro_habilitado: true,
    seguro_percentual: 0.038,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 50,
    permite_lance_embutido: true,
    percentual_lance_embutido: 40,
    percentual_recurso_proprio_sugerido: 5,
    prazo_total: 200,
    parcelas_realizadas: 85,
    prazo_restante: 115,
    seguro_pos_contemplacao: false,
    cet_percentual: 12.6,
    status: "Disponível",
    creditos: [55214, 65258.58, 75000, 212000],
  },
  {
    codigo_grupo: "1533",
    modalidade: "Auto",
    taxa_administrativa_percentual: 18,
    fundo_reserva_percentual: 2,
    seguro_habilitado: true,
    seguro_percentual: 0.05,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 50,
    permite_lance_embutido: true,
    percentual_lance_embutido: 30,
    percentual_recurso_proprio_sugerido: 8,
    prazo_total: 100,
    parcelas_realizadas: 40,
    prazo_restante: 60,
    seguro_pos_contemplacao: false,
    cet_percentual: 14.2,
    status: "Disponível",
    creditos: [45000, 55000, 65000, 78000],
  },
  {
    codigo_grupo: "2045",
    modalidade: "Auto",
    taxa_administrativa_percentual: 17,
    fundo_reserva_percentual: 2,
    seguro_habilitado: false,
    seguro_percentual: 0,
    tem_parcela_reduzida: false,
    percentual_parcela_reduzida: 0,
    permite_lance_embutido: true,
    percentual_lance_embutido: 25,
    percentual_recurso_proprio_sugerido: 10,
    prazo_total: 80,
    parcelas_realizadas: 25,
    prazo_restante: 55,
    seguro_pos_contemplacao: false,
    cet_percentual: 13.5,
    status: "Disponível",
    creditos: [80000, 90000, 105000],
  },
  {
    codigo_grupo: "3012",
    modalidade: "Moto",
    taxa_administrativa_percentual: 16,
    fundo_reserva_percentual: 2,
    seguro_habilitado: true,
    seguro_percentual: 0.045,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 50,
    permite_lance_embutido: true,
    percentual_lance_embutido: 20,
    percentual_recurso_proprio_sugerido: 10,
    prazo_total: 60,
    parcelas_realizadas: 18,
    prazo_restante: 42,
    seguro_pos_contemplacao: false,
    cet_percentual: 15.1,
    status: "Disponível",
    creditos: [15000, 18000, 22000, 28000],
  },
];
