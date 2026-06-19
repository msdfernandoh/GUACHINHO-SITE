"use client";

/** Eventos leves no browser (sem service role). */
export async function registrarEventoClient(input: {
  tipo_evento: string;
  origem?: string;
  entidade_tipo?: string;
  entidade_id?: string;
  lead_id?: string;
}) {
  try {
    await fetch("/api/public/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* ignore */
  }
}
