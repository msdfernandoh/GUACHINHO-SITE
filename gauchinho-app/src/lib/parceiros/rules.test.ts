import { describe, expect, it } from "vitest";
import {
  canLinkUsuarioToParticipante,
  papelTemPermissao,
  parceiroPodeEditarSite,
  podeVerRegistroComercial,
  validateCnpjUnicoNoTenant,
  validateDominioUnico,
  validateGestorMesmaEmpresa,
  validateOrganizacaoCreateInput,
  validateParticipanteCreateInput,
  validateResponsavelPrincipalUnico,
  validateSiteAtivoUnicoPorOrg,
  validateSlugUnicoPorEmpresa,
  validateVinculoParticipanteOrganizacao,
} from "./rules";
import { FASE3_PERMISSOES } from "./constants";
import { normalizeCnpj, normalizeCpf, normalizeSlug, validateParceiroHostForPersist } from "./normalize";

describe("participantes — regras", () => {
  it("permite participante sem login", () => {
    const r = validateParticipanteCreateInput({
      empresaId: "e1",
      nome: "Indicador X",
      tipos: ["INDICADOR"],
      status: "ATIVO",
      whatsapp: "51999999999",
      usuarioId: null,
    });
    expect(r.ok).toBe(true);
  });

  it("aceita participante apenas com email", () => {
    const r = validateParticipanteCreateInput({
      empresaId: "e1",
      nome: "Tayna Pires",
      tipos: ["SDR"],
      status: "ATIVO",
      email: "tayna@msdeducacao.com.br",
    });
    expect(r.ok).toBe(true);
  });

  it("aceita participante apenas com usuarioId vinculado", () => {
    const r = validateParticipanteCreateInput({
      empresaId: "e1",
      nome: "Carlos",
      tipos: ["CONSULTOR"],
      status: "ATIVO",
      usuarioId: "u-123",
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita participante sem nenhum meio de contato e sem usuarioId", () => {
    const r = validateParticipanteCreateInput({
      empresaId: "e1",
      nome: "Sem Contato",
      tipos: ["CONSULTOR"],
      status: "ATIVO",
    });
    expect(r.ok).toBe(false);
  });

  it("aceita múltiplos tipos", () => {
    const r = validateParticipanteCreateInput({
      empresaId: "e1",
      nome: "Ana",
      tipos: ["CONSULTOR", "GESTOR"],
      status: "RASCUNHO",
      telefone: "5133333333",
    });
    expect(r.ok).toBe(true);
  });

  it("bloqueia usuario duplicado ATIVO na mesma empresa", () => {
    const r = canLinkUsuarioToParticipante({
      usuarioId: "u1",
      empresaId: "e1",
      existingActiveLinks: [{ participanteId: "p1", empresaId: "e1", usuarioId: "u1" }],
      participanteId: "p2",
    });
    expect(r.ok).toBe(false);
  });

  it("permite mesmo usuario em empresas distintas", () => {
    const r = canLinkUsuarioToParticipante({
      usuarioId: "u1",
      empresaId: "e2",
      existingActiveLinks: [{ participanteId: "p1", empresaId: "e1", usuarioId: "u1" }],
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita gestor de outra empresa", () => {
    const r = validateGestorMesmaEmpresa({
      participanteEmpresaId: "e1",
      gestorEmpresaId: "e2",
    });
    expect(r.ok).toBe(false);
  });
});

describe("organizações — regras", () => {
  it("rejeita organização de outra empresa no vínculo", () => {
    const r = validateVinculoParticipanteOrganizacao({
      participanteEmpresaId: "e1",
      organizacaoEmpresaId: "e2",
    });
    expect(r.ok).toBe(false);
  });

  it("permite N:N conceitual (vários vínculos válidos mesma empresa)", () => {
    const a = validateVinculoParticipanteOrganizacao({
      participanteEmpresaId: "e1",
      organizacaoEmpresaId: "e1",
    });
    const b = validateVinculoParticipanteOrganizacao({
      participanteEmpresaId: "e1",
      organizacaoEmpresaId: "e1",
    });
    expect(a.ok && b.ok).toBe(true);
  });

  it("responsável principal único por organização", () => {
    const r = validateResponsavelPrincipalUnico({
      organizacaoId: "o1",
      settingPrincipal: true,
      ativo: true,
      existingPrincipals: [{ id: "v1", organizacaoId: "o1", ativo: true }],
      vinculoId: "v2",
    });
    expect(r.ok).toBe(false);
  });

  it("bloqueia CNPJ duplicado no mesmo tenant", () => {
    const cnpj = normalizeCnpj("12.345.678/0001-95");
    const r = validateCnpjUnicoNoTenant({
      empresaId: "e1",
      cnpj,
      existing: [{ id: "o1", empresaId: "e1", cnpj: cnpj! }],
      organizacaoId: "o2",
    });
    expect(r.ok).toBe(false);
  });

  it("permite mesmo CNPJ em tenants distintos", () => {
    const cnpj = normalizeCnpj("12345678000195");
    const r = validateCnpjUnicoNoTenant({
      empresaId: "e2",
      cnpj,
      existing: [{ id: "o1", empresaId: "e1", cnpj: cnpj! }],
    });
    expect(r.ok).toBe(true);
  });

  it("valida criação mínima de organização", () => {
    expect(
      validateOrganizacaoCreateInput({
        empresaId: "e1",
        tipo: "IMOBILIARIA",
        nomeFantasia: "Casa XPTO",
        status: "ATIVA",
        whatsapp: "51999999999",
      }).ok
    ).toBe(true);
  });
});

describe("sites / domínios — regras", () => {
  it("site ativo único por organização", () => {
    const r = validateSiteAtivoUnicoPorOrg({
      organizacaoId: "o1",
      ativo: true,
      statusPublicacao: "RASCUNHO",
      existingActiveSites: [{ id: "s1", organizacaoId: "o1" }],
      siteId: "s2",
    });
    expect(r.ok).toBe(false);
  });

  it("slug duplicado por empresa", () => {
    const r = validateSlugUnicoPorEmpresa({
      empresaId: "e1",
      slug: "Parceiro-Um",
      existing: [{ id: "s1", empresaId: "e1", slug: "parceiro-um" }],
      siteId: "s2",
    });
    expect(r.ok).toBe(false);
  });

  it("domínio duplicado em parceiro_site_dominios", () => {
    const r = validateDominioUnico({
      valor: "parceiro.com.br",
      existingParceiroHosts: ["parceiro.com.br"],
      existingEmpresaHosts: [],
    });
    expect(r.ok).toBe(false);
  });

  it("domínio conflitante com empresa_dominios", () => {
    const r = validateDominioUnico({
      valor: "gauchinhoconsorcios.com.br",
      existingParceiroHosts: [],
      existingEmpresaHosts: ["gauchinhoconsorcios.com.br"],
    });
    expect(r.ok).toBe(false);
  });

  it("rejeita host oficial e wildcard na normalização", () => {
    expect(validateParceiroHostForPersist("www.gauchinhoconsorcios.com.br").ok).toBe(false);
    expect(validateParceiroHostForPersist("*.exemplo.com.br").ok).toBe(false);
  });

  it("normalize slug/cpf/cnpj", () => {
    expect(normalizeSlug(" Meu Parceiro!! ")).toBe("meu-parceiro");
    expect(normalizeCpf("123.456.789-09")).toBe("12345678909");
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
  });
});

describe("permissões / visibilidade", () => {
  it("parceiro_comercial não edita site", () => {
    expect(parceiroPodeEditarSite("parceiro_comercial")).toBe(false);
    expect(papelTemPermissao("parceiro_comercial", FASE3_PERMISSOES.gerenciarSites)).toBe(false);
    expect(papelTemPermissao("admin_empresa", FASE3_PERMISSOES.gerenciarSites)).toBe(true);
  });

  it("parceiro não vê outra organização", () => {
    const r = podeVerRegistroComercial({
      isResponsavelPrincipal: true,
      temVisaoAmpliada: false,
      registroOrganizacaoId: "org-b",
      registroParticipantId: "p1",
      orgsDoUsuario: ["org-a"],
      participantIdAtual: "p1",
    });
    expect(r).toBe(false);
  });

  it("responsável vê toda a org; demais só vínculo próprio", () => {
    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: true,
        temVisaoAmpliada: false,
        registroOrganizacaoId: "org-a",
        registroParticipantId: "outro",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "eu",
      })
    ).toBe(true);

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

    expect(
      podeVerRegistroComercial({
        isResponsavelPrincipal: false,
        temVisaoAmpliada: false,
        registroOrganizacaoId: "org-a",
        registroParticipantId: "eu",
        orgsDoUsuario: ["org-a"],
        participantIdAtual: "eu",
      })
    ).toBe(true);
  });

  it("legado conceitual: permissões de parceiro_imobiliaria não ganham site Fase 3", () => {
    expect(papelTemPermissao("parceiro_imobiliaria", FASE3_PERMISSOES.gerenciarSites)).toBe(false);
    expect(papelTemPermissao("parceiro_imobiliaria", FASE3_PERMISSOES.acessarAreaParceiro)).toBe(
      false
    );
  });

  it("leads/propostas legados com campos NULL não são visíveis na área parceiro", () => {
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
});

describe("service role / client safety", () => {
  it("módulo de regras client-safe não importa server-only", async () => {
    const src = await import("./rules");
    expect(typeof src.validateParticipanteCreateInput).toBe("function");
    // constants/normalize/rules são client-safe; authorization/schema-ready usam server-only
  });
});
