export type PerfilColaborador = "GERADOR_NEGOCIOS" | "GERADOR_OPORTUNIDADES";
export type CadastroColaborador = { nome: string; cpf: string; telefone: string; email: string; senha: string; perfil: PerfilColaborador; pix: string };
export const NOMES_PERFIL: Record<PerfilColaborador,string> = { GERADOR_NEGOCIOS: "Gerador de Negócios", GERADOR_OPORTUNIDADES: "Gerador de Oportunidades" };
