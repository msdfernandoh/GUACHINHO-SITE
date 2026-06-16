export const IMOVEL_TIPOS = [
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "terreno", label: "Terreno" },
  { value: "chacara", label: "Chácara" },
  { value: "fazenda", label: "Fazenda" },
  { value: "area_rural", label: "Área rural" },
  { value: "sala_comercial", label: "Sala comercial" },
  { value: "barracao", label: "Barracão" },
  { value: "galpao", label: "Galpão" },
  { value: "sobrado", label: "Sobrado" },
  { value: "ponto_comercial", label: "Ponto comercial" },
  { value: "outros", label: "Outros" },
] as const;

export type TipoImovel = (typeof IMOVEL_TIPOS)[number]["value"];

export const IMOVEL_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "inativo", label: "Inativo" },
] as const;

export type StatusImovel = (typeof IMOVEL_STATUS)[number]["value"];

export type ImobiliariaRow = {
  id: string;
  nome: string;
  slug: string;
  responsavel: string | null;
  email: string | null;
  whatsapp: string | null;
  telefone: string | null;
  cidade: string | null;
  endereco: string | null;
  estado?: string | null;
  numero?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  site: string | null;
  instagram: string | null;
  logo_url: string | null;
  banner_url: string | null;
  descricao: string | null;
  descricao_curta?: string | null;
  ativo: boolean;
  exibir_home: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type ImovelRow = {
  id: string;
  imobiliaria_id: string;
  titulo: string;
  slug: string;
  tipo_imovel: string;
  cidade: string | null;
  bairro: string | null;
  valor: number | null;
  exibir_valor_publico: boolean;
  foto_principal_url: string | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  link_externo: string | null;
  whatsapp: string | null;
  usar_whatsapp_imobiliaria: boolean;
  status: StatusImovel;
  destaque: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  imobiliarias?: Pick<ImobiliariaRow, "id" | "nome" | "slug" | "whatsapp" | "logo_url"> | null;
};

export type ImovelPublic = ImovelRow & {
  imobiliaria_nome: string;
  imobiliaria_slug: string;
  imobiliaria_whatsapp: string | null;
  imobiliaria?: import("@/lib/imobiliarias/public-card-utils").ImobiliariaPublic;
};
