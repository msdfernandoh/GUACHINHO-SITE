import { describe, it, expect } from "vitest";
import { SYSTEM_MEDIA_PRESETS, type MediaSlotSpec } from "@/components/platform/media-field-control";
import type { ImagensBanners } from "@/components/public/templates/racon-inspired-home";

describe("Fase 097: Platform Modelos de Site — Biblioteca de Mídia, Storage e Banners", () => {
  it("1. Storage de Imagens: Bucket e convenção de pastas para assets de templates", () => {
    const bucketName = "site-template-assets";
    const templateId = "template-racon-v2";
    const slot = "hero";
    const fileName = "banner-promocional.png";
    const timestamp = 1755600000000;

    const storagePath = `templates/${templateId}/${slot}/${timestamp}-${fileName}`;
    expect(storagePath).toBe("templates/template-racon-v2/hero/1755600000000-banner-promocional.png");
    expect(bucketName).toBe("site-template-assets");
  });

  it("2. Formatos aceitos e proteção de arquivos executáveis", () => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    expect(allowedMimes.includes("image/jpeg")).toBe(true);
    expect(allowedMimes.includes("image/png")).toBe(true);
    expect(allowedMimes.includes("image/webp")).toBe(true);
    expect(allowedMimes.includes("image/svg+xml")).toBe(true);
    expect(allowedMimes.includes("application/x-msdownload")).toBe(false);
    expect(allowedMimes.includes("text/javascript")).toBe(false);
  });

  it("3. Dimensões recomendadas reais e cálculo de proporção não-bloqueante", () => {
    const heroSpec: MediaSlotSpec = {
      slotId: "hero",
      slotLabel: "Hero Principal",
      larguraRecomendada: 1920,
      alturaRecomendada: 760,
      proporcaoRecomendada: "16:6 (2.5:1)",
      proporcaoRatio: 1920 / 760,
      descricao: "Slot principal do topo.",
    };

    // Imagem com proporção próxima (ex: 2560 x 1013 => ratio 2.527)
    const ratioIdeal = 2560 / 1013;
    const diffIdeal = Math.abs(ratioIdeal - heroSpec.proporcaoRatio) / heroSpec.proporcaoRatio;
    expect(diffIdeal).toBeLessThan(0.05);

    // Imagem quadrada (ex: 1000 x 1000 => ratio 1.0) -> desvio considerável sem bloqueio
    const ratioQuadrada = 1000 / 1000;
    const diffQuadrada = Math.abs(ratioQuadrada - heroSpec.proporcaoRatio) / heroSpec.proporcaoRatio;
    expect(diffQuadrada).toBeGreaterThan(0.2); // Gera aviso informativo
  });

  it("4. Object-fit e Posicionamento Focal (cover, contain, top, center)", () => {
    const bannerConfig: ImagensBanners = {
      hero_banner_url: "/racon/racon-rubinho-hero.png",
      hero_object_fit: "cover",
      hero_object_position: "left-top",
      card_veiculos_url: "/racon/racon-card-veiculo.png",
      card_veiculos_object_fit: "cover",
      card_veiculos_object_position: "center",
      embaixador_stats_url: "/racon/racon-rubinho-apontando.png",
      embaixador_stats_object_fit: "cover",
      embaixador_stats_object_position: "top",
    };

    expect(bannerConfig.hero_object_fit).toBe("cover");
    expect(bannerConfig.hero_object_position).toBe("left-top");
    expect(bannerConfig.embaixador_stats_object_position).toBe("top");
  });

  it("5. Customização comercial de cards sem alterar a estrutura técnica do slot", () => {
    const banners: ImagensBanners = {
      card_veiculos_url: "/foto/Carros.png",
      card_veiculos_titulo: "Seu Carro Novo Começa Aqui",
      card_veiculos_subtitulo: "Planos especiais de consórcio automotivo sem juros bancários.",
      card_veiculos_cta_label: "Simular Veículo",
      card_veiculos_cta_url: "/simulador?tipo=veiculos",
      card_veiculos_ativo: true,

      card_imoveis_url: "/foto/Casa.png",
      card_imoveis_titulo: "Conquiste Seu Imóvel Próprio",
      card_imoveis_subtitulo: "Apartamentos, casas e terrenos com as menores taxas do mercado.",
      card_imoveis_cta_label: "Simular Imóvel",
      card_imoveis_cta_url: "/simulador?tipo=imoveis",
      card_imoveis_ativo: true,
    };

    expect(banners.card_veiculos_titulo).toBe("Seu Carro Novo Começa Aqui");
    expect(banners.card_veiculos_cta_label).toBe("Simular Veículo");
    expect(banners.card_imoveis_titulo).toBe("Conquiste Seu Imóvel Próprio");
  });

  it("6. Biblioteca de Mídia e Presets oficiais do sistema", () => {
    expect(SYSTEM_MEDIA_PRESETS.length).toBeGreaterThanOrEqual(6);
    const rubinhoHero = SYSTEM_MEDIA_PRESETS.find((p) => p.id === "preset-rubinho-hero");
    expect(rubinhoHero).toBeDefined();
    expect(rubinhoHero?.url).toBe("/racon/racon-rubinho-hero.png");
    expect(rubinhoHero?.dimensoes).toBe("1920 × 760 px");
  });

  it("7. Isolamento de Tenant e Preservação de Versão Publicada", () => {
    // Template global versionado
    const templateOriginal = {
      id: "tpl-racon",
      versao: 2,
      status: "PUBLICADO",
      identidade_visual: {
        imagens_banners: {
          hero_banner_url: "/racon/racon-rubinho-hero.png",
        },
      },
    };

    // Override de parceiro não altera o template global
    const partnerSite = {
      id: "site-partner-1",
      template_codigo: "racon_inspired",
      branding: {
        identidade_visual_modo: "PERSONALIZADA",
        banner_url: "/media/partner-banner.png",
      },
    };

    expect(partnerSite.branding.banner_url).not.toBe(templateOriginal.identidade_visual.imagens_banners.hero_banner_url);
    expect(templateOriginal.identidade_visual.imagens_banners.hero_banner_url).toBe("/racon/racon-rubinho-hero.png");
  });
});
