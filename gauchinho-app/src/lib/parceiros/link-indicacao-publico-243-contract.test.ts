import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("fase 243 - link público do indicador", () => {
  it("cria token não enumerável e único dentro do tenant", () => {
    const migration = source("../supabase/migrations/243_link_publico_indicador_chat.sql");
    expect(migration).toContain("codigo_indicacao uuid NOT NULL DEFAULT gen_random_uuid()");
    expect(migration).toContain("(empresa_id, codigo_indicacao)");
  });

  it("resolve o link somente no tenant do host e atribui a indicação ao indicador", () => {
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    expect(route).toContain('acao === "indicar_por_link"');
    expect(route).toContain('.eq("empresa_id", ingress.empresaId)');
    expect(route).toContain('.eq("codigo_indicacao_curto", codigoIndicacao)');
    expect(route).toContain("indicador_id: indicador.id");
    expect(route).toContain('origem_detalhe: "Link público do indicador"');
  });

  it("usa código curto e registra a qualificação estratégica no lead", () => {
    const migration = source("../supabase/migrations/244_link_curto_e_qualificacao_indicacao.sql");
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    expect(migration).toContain("codigo_indicacao_curto text");
    expect(migration).toContain("estrategia_credito text");
    expect(migration).toContain("prazo_utilizacao_credito text");
    expect(route).toContain("estrategia_credito: estrategiaTexto");
    expect(route).toContain("prazo_utilizacao_credito: prazoTexto");
  });

  it("reutiliza o chat do app no cadastro público e exibe o link no painel", () => {
    expect(source("src/app/(public)/indicacao/[codigo]/page.tsx")).toContain("<IndicacaoChat");
    expect(source("src/components/app-indicador/indicacao-chat.tsx")).toContain("codigoIndicacao");
    expect(source("src/app/app-indicador/page.tsx")).toContain("IndicadorLinkCard");
  });

  it("mostra modelo comercial e os dois links no app", () => {
    const page = source("src/app/app-indicador/page.tsx");
    expect(page).toContain('MICROFRANQUEADO: "Microfranqueado"');
    expect(page).toContain('GERADOR_NEGOCIOS: "Gerador de Negócios"');
    expect(page).toContain('GERADOR_POSSIBILIDADES: "Gerador de Possibilidades"');
    expect(page).toContain("/network/${indicador.codigo_indicacao_curto}");
    expect(page).toContain('titulo="Link para novos interessados"');
    expect(page).toContain('titulo="Convite do Network de Negócios"');
  });

  it("reutiliza o participante criado pelo trigger no cadastro público", () => {
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    expect(route).toContain("participanteCriadoPeloVinculo");
    expect(route).toContain("participanteResult");
    expect(route).toContain("Nenhum acesso incompleto foi mantido");
  });

  it("registra o convite do Network com tenant, indicador e lead", () => {
    const migration = source("../supabase/migrations/245_convite_network_indicador.sql");
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.programa_convites_network");
    expect(migration).toContain("empresa_id uuid NOT NULL");
    expect(migration).toContain("indicador_id uuid NOT NULL");
    expect(route).toContain('acao === "confirmar_network"');
    expect(route).toContain('evento_codigo: "NETWORK_2026_09_29"');
    expect(source("src/app/(public)/network/[codigo]/page.tsx")).toContain("NetworkConviteForm");
  });

  it("salva preferências de atendimento no lead e no histórico", () => {
    const migration = source("../supabase/migrations/247_preferencias_atendimento_indicacao_e_segundo_vendedor.sql");
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    const upsert = source("src/lib/crm/upsert-lead.ts");
    expect(migration).toContain("preferencia_atendimento text");
    expect(migration).toContain("quando_atendimento text");
    expect(migration).toContain("periodo_contato text");
    expect(route).toContain("preferencia_atendimento: preferenciaTexto");
    expect(route).toContain("quando_atendimento: quandoTexto");
    expect(route).toContain("periodo_contato: periodoTexto");
    expect(upsert).toContain("• Preferência de atendimento:");
    expect(upsert).toContain("• Melhor período para contato:");
  });

  it("preserva o rascunho por link e mantém o nome do indicador visível", () => {
    const chat = source("src/components/app-indicador/indicacao-chat.tsx");
    expect(chat).toContain("window.localStorage.setItem");
    expect(chat).toContain("window.localStorage.getItem");
    expect(chat).toContain("Indicação de");
    expect(chat).toContain("FALTA POUCO");
    expect(chat).toContain("preferenciasAtendimento");
    expect(chat).toContain("momentosAtendimento");
    expect(chat).toContain("periodosContato");
  });

  it("fixa o participante do indicador como segundo vendedor sem rateio manual duplicado", () => {
    const migration = source("../supabase/migrations/247_preferencias_atendimento_indicacao_e_segundo_vendedor.sql");
    const action = source("src/app/erp/contratacoes/actions.ts");
    const page = source("src/app/erp/contratacoes/[id]/page.tsx");
    expect(migration).toContain("'PARTICIPANTE_SECUNDARIO'");
    expect(migration).toContain("'INDICADOR'");
    expect(migration).toContain("AFTER INSERT ON public.vendas");
    expect(action).toContain("secundarioId = null");
    expect(action).toContain("perfilSecundarioId = null");
    expect(page).toContain("indicadorSegundoVendedor={indicadorSegundoVendedor}");
  });
});
