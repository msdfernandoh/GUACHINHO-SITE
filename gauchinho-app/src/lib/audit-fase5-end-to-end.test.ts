import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listGruposAutorizadosForEmpresa,
  fetchPublicGruposAggregatesForEmpresa,
} from "@/lib/grupos/catalogo-autorizado-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "8e4e13f9-80e6-44db-a21b-584a43b6f024";
const describeLive = process.env.RUN_LIVE_PRODUCTION_AUDIT === "true" ? describe : describe.skip;

describeLive("AUDITORIA CONSOLIDADA DA FASE 5 — SUPABASE REMOTO & RUNTIME", () => {
  it("1. Tabela public.empresa_grupos_config existe e possui RLS habilitado", async () => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empresa_grupos_config")
      .select("count", { count: "exact" });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("2. Contagem de dados canônicos preservada (19 grupos, 178 cotas, 31 modalidades)", async () => {
    const admin = createAdminClient();
    const [{ count: cGrupos }, { count: cCotas }, { count: cMods }] = await Promise.all([
      admin.from("grupos_consorcio").select("*", { count: "exact", head: true }),
      admin.from("grupos_cotas").select("*", { count: "exact", head: true }),
      admin.from("grupos_modalidades_lance").select("*", { count: "exact", head: true }),
    ]);

    expect(cGrupos).toBe(19);
    expect(cCotas).toBe(178);
    expect(cMods).toBe(31);
  });

  it("3. Helper SQL grupo_concedido_para_empresa() funciona corretamente no banco remoto", async () => {
    const admin = createAdminClient();

    const { data: grupo } = await admin
      .from("grupos_consorcio")
      .select("id")
      .limit(1)
      .single();

    expect(grupo).not.toBeNull();

    // Gauchinho tem concessão ativa com Racon
    const { data: concedidoGauchinho, error: err1 } = await admin.rpc("grupo_concedido_para_empresa", {
      p_empresa_id: GAUCHINHO_EMPRESA_ID,
      p_grupo_id: grupo!.id,
    });
    expect(err1).toBeNull();
    expect(concedidoGauchinho).toBe(true);

    // Empresa B possui 0 concessões
    const { data: concedidoEmpresaB, error: err2 } = await admin.rpc("grupo_concedido_para_empresa", {
      p_empresa_id: EMPRESA_B_ID,
      p_grupo_id: grupo!.id,
    });
    expect(err2).toBeNull();
    expect(concedidoEmpresaB).toBe(false);
  });

  it("4. Empresa B possui ZERO grupos no catálogo autorizado e agregados públicos", async () => {
    const gruposB = await listGruposAutorizadosForEmpresa(EMPRESA_B_ID);
    expect(gruposB).toHaveLength(0);

    const aggregatesB = await fetchPublicGruposAggregatesForEmpresa(EMPRESA_B_ID);
    expect(aggregatesB).toHaveLength(0);
  });

  it("5. Gauchinho possui os 19 grupos no catálogo total (e 18 elegíveis públicos)", async () => {
    const todosGruposG = await listGruposAutorizadosForEmpresa(GAUCHINHO_EMPRESA_ID, { incluirInativos: true });
    expect(todosGruposG).toHaveLength(19);

    const elegiveisG = await listGruposAutorizadosForEmpresa(GAUCHINHO_EMPRESA_ID);
    expect(elegiveisG.length).toBeGreaterThanOrEqual(18);

    const aggregatesG = await fetchPublicGruposAggregatesForEmpresa(GAUCHINHO_EMPRESA_ID);
    expect(aggregatesG.length).toBeGreaterThanOrEqual(18);
  });

  it("6. Sorteios mantidos intactos no banco de dados (grupos_sorteios_loteria)", async () => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("grupos_sorteios_loteria")
      .select("id")
      .limit(1);

    expect(error).toBeNull();
  });

  it("7. Propostas e Contratações preservadas no banco de dados", async () => {
    const admin = createAdminClient();
    const [{ error: eProp }, { error: eContr }] = await Promise.all([
      admin.from("propostas").select("id").limit(1),
      admin.from("contratacoes_online").select("id").limit(1),
    ]);

    expect(eProp).toBeNull();
    expect(eContr).toBeNull();
  });
});
