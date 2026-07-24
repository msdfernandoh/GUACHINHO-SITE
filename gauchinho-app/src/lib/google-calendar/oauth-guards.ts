export function shouldBindGoogleOAuthToken(
  cookieUsuarioId: string | null | undefined,
  sessionUsuario: { id: string } | null | undefined,
): boolean {
  if (!cookieUsuarioId || !sessionUsuario?.id) return false;
  return cookieUsuarioId === sessionUsuario.id;
}
