import type { LeadListRow } from "@/lib/crm/types";

function esc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function leadsToCsv(rows: LeadListRow[]): string {
  const header = [
    "nome",
    "whatsapp",
    "email",
    "cidade",
    "origem",
    "produto",
    "valor",
    "status",
    "temperatura",
    "consultor",
    "created_at",
    "ultima_interacao",
    "proxima_acao",
    "data_proxima_acao",
  ];
  const lines = rows.map((r) =>
    [
      esc(r.nome),
      esc(r.whatsapp),
      esc(r.email),
      esc(r.cidade),
      esc(r.origem),
      esc(r.produto_interesse ?? r.tipo_interesse),
      esc(r.valor_estimado ?? r.valor_simulado),
      esc(r.status),
      esc(r.temperatura),
      esc(r.srd_responsavel_nome),
      esc(r.created_at),
      esc(r.ultima_interacao_at),
      esc(r.proxima_acao),
      esc(r.data_proxima_acao ?? r.proximo_retorno_data),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
