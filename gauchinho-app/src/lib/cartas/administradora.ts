export type CartaAdministradoraOption = {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  razao_social?: string | null;
  status: string;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function resolveCartaAdministradora(
  input: { administradoraId?: string | null; administradora?: string | null },
  options: CartaAdministradoraOption[],
): { administradora_id: string; administradora: string } {
  const administradoraId = input.administradoraId?.trim() || null;
  const administradoraText = normalize(input.administradora);
  const ativas = options.filter((option) => option.status === "ATIVA");

  const match = administradoraId
    ? ativas.find((option) => option.id === administradoraId)
    : ativas.find((option) =>
        [option.nome, option.nome_fantasia, option.razao_social]
          .map(normalize)
          .filter(Boolean)
          .includes(administradoraText),
      );

  if (!match) throw new Error("Administradora inválida ou inativa.");
  if (
    administradoraId &&
    administradoraText &&
    ![match.nome, match.nome_fantasia, match.razao_social]
      .map(normalize)
      .filter(Boolean)
      .includes(administradoraText)
  ) {
    throw new Error("Administradora inválida ou inativa.");
  }

  return { administradora_id: match.id, administradora: match.nome };
}

export function isMissingCartaAdministradoraIdColumn(message: string | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("administradora_id") &&
    (normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("could not find"))
  );
}

export function withoutCartaAdministradoraId<T extends { administradora_id?: string | null }>(
  payload: T,
): Omit<T, "administradora_id"> {
  const { administradora_id: _ignored, ...legacyPayload } = payload;
  return legacyPayload;
}
