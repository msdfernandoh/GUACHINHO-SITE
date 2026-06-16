"use client";

import { useEffect } from "react";
import { registrarEventoClient } from "@/lib/eventos/registrar-client";

type Props = {
  tipo_evento: string;
  entidade_tipo?: string;
  entidade_id?: string;
};

export function ConteudoViewTracker({ tipo_evento, entidade_tipo, entidade_id }: Props) {
  useEffect(() => {
    registrarEventoClient({
      tipo_evento,
      origem: "conteudo",
      entidade_tipo,
      entidade_id,
    });
  }, [tipo_evento, entidade_tipo, entidade_id]);

  return null;
}
