import { describe, expect, it } from "vitest";
import {
  FASE3_PAPEL_PERMISSOES,
  FASE3_PARCEIRO_AREA_ENABLED,
  FASE3_PERMISSOES,
  LEAD_STATUS_SIMPLES_PARCEIRO,
  PAPEL_PARCEIRO_COMERCIAL,
  PROPOSTA_STATUS_EDITAVEL_PARCEIRO,
} from "./constants";
import {
  assertOrgNoContextoArea,
  papelTemPermissao,
  parceiroPodeEditarSite,
  podeVerRegistroComercial,
  propostaStatusEditavelParceiro,
  sanitizeLeadUpdateParceiro,
} from "./rules";

describe("E7 — área comercial parceiro", () => {
  it("flag área parceiro desligada por padrão", () => {
    expect(FASE3_PARCEIRO_AREA_ENABLED).toBe(false);
  });

  it("parceiro_comercial tem perms comerciais e não tem site/admin", () => {
    const perms = FASE3_PAPEL_PERMISSOES[PAPEL_PARCEIRO_COMERCIAL];
    expect(perms).toContain(FASE3_PERMISSOES.acessarAreaParceiro);
    expect(perms).toContain(FASE3_PERMISSOES.visualizarLeads);
    expect(perms).toContain(FASE3_PERMISSOES.criarPropostas);
    expect(perms).not.toContain(FASE3_PERMISSOES.gerenciarSites);
    expect(perms).not.toContain(FASE3_PERMISSOES.gerenciarOrganizacoes);
    expect(perms).not.toContain(FASE3_PERMISSOES.gerenciarParticipantes);
    expect(perms).not.toContain(FASE3_PERMISSOES.visaoAmpliadaOrg);
    expect(parceiroPodeEditarSite(PAPEL_PARCEIRO_COMERCIAL)).toBe(false);
  });

  it("nega lead de outra org", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: true,
        temVisaoAmpliada: true,
        registroOrganizacaoId: "org-b",
        registroParticipantId: "p1",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "p1",
      })
    ).toBe(false);
  });

  it("participante normal não vê lead de outro participant", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: false,
        temVisaoAmpliada: false,
        registroOrganizacaoId: "org-a",
        registroParticipantId: "outro",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "eu",
      })
    ).toBe(false);
  });

  it("RESPONSAVEL_PARCEIRO (tipo) vê toda a org", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: false,
        isResponsavelParceiroTipo: true,
        temVisaoAmpliada: false,
        registroOrganizacaoId: "org-a",
        registroParticipantId: "outro",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "eu",
      })
    ).toBe(true);
  });

  it("visão ampliada só com permissão explícita", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: false,
        temVisaoAmpliada: true,
        registroOrganizacaoId: "org-a",
        registroParticipantId: "outro",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "eu",
      })
    ).toBe(true);
    expect(papelTemPermissao("parceiro_comercial", FASE3_PERMISSOES.visaoAmpliadaOrg)).toBe(false);
  });

  it("legado NULL não aparece", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: true,
        temVisaoAmpliada: true,
        registroOrganizacaoId: null,
        registroParticipantId: null,
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "p1",
      })
    ).toBe(false);
  });

  it("rejeita alteração de empresa_id / org no sanitize", () => {
    expect(sanitizeLeadUpdateParceiro({ empresa_id: "outra" }).ok).toBe(false);
    expect(sanitizeLeadUpdateParceiro({ organizacao_parceira_id: "outra" }).ok).toBe(false);
  });

  it("org fora do contexto é rejeitada", () => {
    expect(assertOrgNoContextoArea({ orgId: "org-b", orgsDoUsuario: ["org-a"] }).ok).toBe(false);
    expect(assertOrgNoContextoArea({ orgId: "org-a", orgsDoUsuario: ["org-a"] }).ok).toBe(true);
  });

  it("proposta editável só em Gerada/PDF gerado", () => {
    for (const s of PROPOSTA_STATUS_EDITAVEL_PARCEIRO) {
      expect(propostaStatusEditavelParceiro(s)).toBe(true);
    }
    expect(propostaStatusEditavelParceiro("Enviada")).toBe(false);
    expect(propostaStatusEditavelParceiro("Aprovada")).toBe(false);
    expect(propostaStatusEditavelParceiro("RASCUNHO")).toBe(false);
  });

  it("status simples de lead cobertos", () => {
    expect(LEAD_STATUS_SIMPLES_PARCEIRO).toContain("Novo");
    expect(LEAD_STATUS_SIMPLES_PARCEIRO).not.toContain("Arquivado CRM avançado");
  });
});
