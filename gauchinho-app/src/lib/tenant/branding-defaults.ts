/** Constantes de branding — sem server-only (usadas em regras/testes). */
export const GAUCHINHO_DEFAULT_COLORS = {
  cor_primaria: "#0A1628",
  cor_secundaria: "#0D1F3C",
  cor_destaque: "#C9A84C",
} as const;

export const EMPRESA_B_DEV_BRANDING = {
  nome_site: "Empresa B Consórcios",
  subtitulo: "Tenant de demonstração (dados fictícios)",
  descricao_institucional:
    "Empresa de demonstração usada para validar o isolamento multiempresa da plataforma.",
  logo_url: null as string | null,
  logo_claro_url: null as string | null,
  logo_escuro_url: null as string | null,
  favicon_url: null as string | null,
  cor_primaria: "#1B2E1B",
  cor_secundaria: "#294529",
  cor_destaque: "#7FB77E",
  telefone: "",
  whatsapp: "",
  email_contato: "",
  redes_sociais: {} as Record<string, string>,
  seo_titulo: "Empresa B Consórcios",
  seo_descricao: "Site institucional de demonstração multiempresa.",
  status_publicacao: "RASCUNHO" as const,
};
