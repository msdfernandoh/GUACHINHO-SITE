import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/246_eventos_recorrencia_semanal.sql"),
  "utf8",
);
const cron = readFileSync(
  resolve(process.cwd(), "src/app/api/cron/eventos-recorrentes/route.ts"),
  "utf8",
);
const form = readFileSync(
  resolve(process.cwd(), "src/components/admin/eventos/evento-admin-form.tsx"),
  "utf8",
);

describe("Fase 261 — eventos recorrentes semanais", () => {
  it("mantém uma série semanal idempotente, com nome e slug datados", () => {
    expect(migration).toContain("recorrencia_ativa boolean");
    expect(migration).toContain("rpc_gerar_proxima_edicao_evento");
    expect(migration).toContain("interval '7 days'");
    expect(migration).toContain(
      "to_char(v_proxima_data at time zone 'America/Cuiaba', 'DD/MM')",
    );
    expect(migration).toContain("v_slug_base || '-' || to_char");
  });

  it("não reutiliza participantes, sorteios, leads ou resultados de uma edição", () => {
    expect(migration).not.toContain("insert into public.eventos_participantes");
    expect(migration).not.toContain(
      "insert into public.eventos_sorteio_participantes",
    );
    expect(migration).not.toContain("insert into public.eventos_sorteios");
    expect(migration).not.toContain("insert into public.leads");
  });

  it("preserva o QR físico ao criar um novo vínculo para a próxima edição", () => {
    expect(migration).toContain("qr_codes_unicos_vinculos");
    expect(migration).toContain("set ativo = false");
    expect(migration).toContain(
      "v_proxima_data + (v_qr.periodo_inicio - v_ultima.data_evento)",
    );
  });

  it("tem checkbox de recorrência e cron protegido por segredo", () => {
    expect(form).toContain("Repetir este evento toda terça-feira");
    expect(cron).toContain("process.env.CRON_SECRET");
    expect(cron).toContain("rpc_processar_eventos_recorrentes");
  });
});
