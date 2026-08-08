import { ADMINISTRADORA_NOT_FOUND_MESSAGE } from "./constants";

/** Erro uniforme NOT_FOUND — não distingue inexistente vs sem concessão. */
export class AdministradoraNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;

  constructor(message = ADMINISTRADORA_NOT_FOUND_MESSAGE) {
    super(message);
    this.name = "AdministradoraNotFoundError";
  }
}

export function throwAdministradoraNotFound(): never {
  throw new AdministradoraNotFoundError();
}

export function isAdministradoraNotFoundError(err: unknown): err is AdministradoraNotFoundError {
  return err instanceof AdministradoraNotFoundError ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "NOT_FOUND" &&
      err instanceof Error &&
      err.message === ADMINISTRADORA_NOT_FOUND_MESSAGE);
}
