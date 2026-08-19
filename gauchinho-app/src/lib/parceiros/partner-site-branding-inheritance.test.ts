import { describe, expect, it } from "vitest";
import { buildPartnerPublicViewModel } from "./public-site-data";
import type { SiteBranding } from "./branding";

describe("SaaS Multi-tenancy: Herança e Personalização de Identidade Visual em Sites de Parceiros", () => {
  const MASTER_EMPRESA_BASE = {
    id: "emp-master-001",
    slug: "gauchinho",
    nome: "Gauchinho Consórcios",
    logo_url: "https://gauchinho.com.br/logo-master.png",
    cor_primaria: "#003366",
    cor_secundaria: "#001A33",
    cor_destaque: "#C9A84C",
    banner_url: "https://gauchinho.com.br/banner-master.png",
    telefone: "5133334444",
    whatsapp: "51999998888",
    email: "contato@gauchinhoconsorcios.com.br",
  };

  const ORG_BASE = {
    id: "org-001",
    nome_fantasia: "Parceiro RS Representações",
    logo_url: "https://org.com/logo-org.png",
    telefone: "5130001111",
    whatsapp: "51988887777",
    email: "contato@parceirors.com.br",
    instagram: "@parceirors",
  };

  const SITE_A_BASE = {
    id: "site-a",
    empresa_id: MASTER_EMPRESA_BASE.id,
    organizacao_parceira_id: ORG_BASE.id,
    slug: "parceiro-a",
    nome_site: "Parceiro A Consórcios",
    descricao: "Site do Parceiro A",
    template_codigo: "institucional_v1",
    status_publicacao: "PUBLICADO",
    canal_principal: "ROTA",
    whatsapp_modo: "EMPRESA",
    whatsapp: null,
    branding: {
      identidade_visual_modo: "HERDAR_MASTER" as const,
    },
    menus: [{ codigo: "INICIO", habilitado: true }],
    seo: null,
  };

  const SITE_B_BASE = {
    id: "site-b",
    empresa_id: MASTER_EMPRESA_BASE.id,
    organizacao_parceira_id: ORG_BASE.id,
    slug: "parceiro-b",
    nome_site: "Parceiro B Consórcios",
    descricao: "Site do Parceiro B",
    template_codigo: "institucional_v1",
    status_publicacao: "PUBLICADO",
    canal_principal: "ROTA",
    whatsapp_modo: "PROPRIO",
    whatsapp: "51977776666",
    branding: {
      identidade_visual_modo: "PERSONALIZADA" as const,
      logo_url: "https://partner-b.com/logo-custom.png",
      cor_primaria: "#FF5500",
      cor_secundaria: "#CC4400",
      cor_destaque: "#FFD700",
      banner_url: "https://partner-b.com/banner-custom.png",
      texto_hero: "Especialista em Consórcios Imobiliários B",
    } as SiteBranding,
    menus: [{ codigo: "INICIO", habilitado: true }],
    seo: null,
  };

  it("Cenário A: Parceiro A com modo HERDAR_MASTER herda logo, cores e banner da Master Franquia", () => {
    const viewA = buildPartnerPublicViewModel({
      site: SITE_A_BASE,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });

    expect(viewA.logo_url).toBe("https://gauchinho.com.br/logo-master.png");
    expect(viewA.cor_primaria).toBe("#003366");
    expect(viewA.cor_secundaria).toBe("#001A33");
    expect(viewA.cor_destaque).toBe("#C9A84C");
    expect(viewA.banner_url).toBe("https://gauchinho.com.br/banner-master.png");
    expect(viewA.tenant_identificacao).toContain("Gauchinho Consórcios");
  });

  it("Cenário B: Parceiro B com modo PERSONALIZADA aplica overrides próprios sem afetar a Master ou Parceiro A", () => {
    const viewB = buildPartnerPublicViewModel({
      site: SITE_B_BASE,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });

    // Parceiro B tem suas cores e logos customizados
    expect(viewB.logo_url).toBe("https://partner-b.com/logo-custom.png");
    expect(viewB.cor_primaria).toBe("#FF5500");
    expect(viewB.cor_secundaria).toBe("#CC4400");
    expect(viewB.cor_destaque).toBe("#FFD700");
    expect(viewB.banner_url).toBe("https://partner-b.com/banner-custom.png");
    expect(viewB.texto_hero).toBe("Especialista em Consórcios Imobiliários B");

    // Master Franquia e Parceiro A continuam intactos
    const viewA = buildPartnerPublicViewModel({
      site: SITE_A_BASE,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });
    expect(viewA.cor_primaria).toBe("#003366");
    expect(viewA.logo_url).toBe("https://gauchinho.com.br/logo-master.png");
  });

  it("Cenário C: Alteração de branding da Master Franquia reflete em Parceiro A mas preserva overrides de Parceiro B", () => {
    const masterAtualizada = {
      ...MASTER_EMPRESA_BASE,
      logo_url: "https://gauchinho.com.br/novo-logo-2026.png",
      cor_primaria: "#0099FF",
    };

    const viewA = buildPartnerPublicViewModel({
      site: SITE_A_BASE,
      org: ORG_BASE,
      empresa: masterAtualizada,
    });
    // Parceiro A recebe automaticamente as alterações da Master
    expect(viewA.logo_url).toBe("https://gauchinho.com.br/novo-logo-2026.png");
    expect(viewA.cor_primaria).toBe("#0099FF");

    const viewB = buildPartnerPublicViewModel({
      site: SITE_B_BASE,
      org: ORG_BASE,
      empresa: masterAtualizada,
    });
    // Parceiro B mantém seus overrides independentes
    expect(viewB.logo_url).toBe("https://partner-b.com/logo-custom.png");
    expect(viewB.cor_primaria).toBe("#FF5500");
  });

  it("Cenário D: Remoção/desativação do override no Parceiro B faz o site voltar imediatamente a herdar a Master", () => {
    const siteBRevertido = {
      ...SITE_B_BASE,
      branding: {
        identidade_visual_modo: "HERDAR_MASTER" as const,
      },
    };

    const viewBRevertido = buildPartnerPublicViewModel({
      site: siteBRevertido,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });

    expect(viewBRevertido.logo_url).toBe("https://gauchinho.com.br/logo-master.png");
    expect(viewBRevertido.cor_primaria).toBe("#003366");
    expect(viewBRevertido.cor_secundaria).toBe("#001A33");
    expect(viewBRevertido.cor_destaque).toBe("#C9A84C");
  });

  it("Cenário E: Overrides de parceiros nunca alteram o layout estrutural ou o template global", () => {
    const viewA = buildPartnerPublicViewModel({
      site: SITE_A_BASE,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });
    const viewB = buildPartnerPublicViewModel({
      site: SITE_B_BASE,
      org: ORG_BASE,
      empresa: MASTER_EMPRESA_BASE,
    });

    expect(viewA.template_codigo).toBe("institucional_v1");
    expect(viewB.template_codigo).toBe("institucional_v1");
    expect(viewA.menus.length).toBe(viewB.menus.length);
  });
});
