export const CARTA_STATUS = [
  "disponivel",
  "consultar_disponibilidade",
  "em_negociacao",
  "reservada",
  "vendida",
  "indisponivel",
  "inativa",
] as const;

export type CartaStatus = (typeof CARTA_STATUS)[number];

export const CARTA_TIPOS = [
  { value: "imovel", label: "Imóvel" },
  { value: "automovel", label: "Automóvel" },
] as const;

export type CartaTipo = (typeof CARTA_TIPOS)[number]["value"];

export const CARTA_STATUS_LABELS: Record<CartaStatus, string> = {
  disponivel: "Disponível",
  consultar_disponibilidade: "Consultar disponibilidade",
  em_negociacao: "Em negociação",
  reservada: "Reservada",
  vendida: "Vendida",
  indisponivel: "Indisponível",
  inativa: "Inativa",
};

export type CartaContemplada = {
  id: string;
  tipo_carta: CartaTipo;
  administradora: string | null;
  credito: number | null;
  entrada: number | null;
  prazo_quantidade: number | null;
  valor_parcela: number | null;
  saldo_devedor: number | null;
  proxima_parcela_data: string | null;
  taxa_transferencia: number | null;
  texto_original: string | null;
  status: CartaStatus;
  ativo: boolean;
  destaque: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type ParsedCartaWhatsApp = {
  tipo_carta: CartaTipo | null;
  administradora: string | null;
  credito: number | null;
  entrada: number | null;
  prazo_quantidade: number | null;
  valor_parcela: number | null;
  saldo_devedor: number | null;
  proxima_parcela_data: string | null;
  taxa_transferencia: number | null;
  texto_original: string;
};
