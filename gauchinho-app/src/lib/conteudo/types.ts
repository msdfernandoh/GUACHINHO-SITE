export type CasoSucesso = {
  id: string;
  titulo: string;
  slug: string;
  categoria: string | null;
  nome_cliente: string | null;
  cidade: string | null;
  estado: string | null;
  tipo_objetivo: string | null;
  valor_credito: number | null;
  descricao_curta: string | null;
  conteudo: string | null;
  imagem_url: string | null;
  video_url: string | null;
  destaque: boolean;
  publicado: boolean;
  ordem: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type Depoimento = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  texto: string;
  foto_url: string | null;
  video_url: string | null;
  nota: number | null;
  tipo_interesse: string | null;
  destaque: boolean;
  publicado: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type DicaTche = {
  id: string;
  titulo: string;
  slug: string;
  categoria: string | null;
  descricao_curta: string | null;
  conteudo: string | null;
  imagem_url: string | null;
  video_url: string | null;
  publicado: boolean;
  destaque: boolean;
  ordem: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type PerguntaFrequente = {
  id: string;
  pergunta: string;
  resposta: string;
  categoria: string | null;
  publicado: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type ParceiroInstitucional = {
  id: string;
  nome: string;
  tipo: string | null;
  descricao: string | null;
  logo_url: string | null;
  site_url: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  destaque: boolean;
  publicado: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export const CASO_CATEGORIAS = [
  "Imóvel",
  "Automóvel",
  "Moto",
  "Caminhão",
  "Carta contemplada",
  "Planejamento financeiro",
  "Investimento",
] as const;

export const DICA_CATEGORIAS = [
  "Consórcio",
  "Financiamento",
  "Cartas contempladas",
  "Lance",
  "Imóveis",
  "Veículos",
  "Planejamento financeiro",
  "Dicas rápidas",
] as const;

export const FAQ_CATEGORIAS = [
  "Consórcio",
  "Financiamento",
  "Cartas contempladas",
  "Grupos",
  "Imóveis",
  "Lance",
  "Atendimento",
] as const;

export const PARCEIRO_TIPOS = [
  "Administradora",
  "Imobiliária",
  "Corretor parceiro",
  "Correspondente",
  "Empresa parceira",
  "Institucional",
] as const;
