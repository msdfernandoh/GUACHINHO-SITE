export const USUARIO_ADMIN_FLASH: Record<string, string> = {
  salvo: "Usuário atualizado com sucesso.",
  sem_gmail: "Google Agenda só pode ser habilitado para e-mails @gmail.com.",
  sem_permissao: "Sem permissão para editar usuários.",
  invalido: "Dados inválidos. Verifique nome, e-mail e perfil.",
  senha_curta: "A nova senha deve ter no mínimo 8 caracteres.",
  nao_encontrado: "Usuário não encontrado.",
  auth: "Não foi possível atualizar o login (Auth). Verifique se o e-mail já está em uso.",
  google_parcial:
    "Usuário salvo, mas Google Agenda não foi gravado. Aplique a migration 033 no Supabase.",
  menus_parcial:
    "Usuário salvo, mas menus personalizados não foram gravados. Aplique a migration 027 no Supabase.",
  erp_permissoes_pendentes:
    "Usuário salvo, mas sócio pagador e menus individuais do ERP aguardam a migration 077 no Supabase.",
  generico: "Não foi possível salvar. Tente novamente.",
};

export function usuarioAdminFlashMessage(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return USUARIO_ADMIN_FLASH[codigo] ?? USUARIO_ADMIN_FLASH.generico;
}
