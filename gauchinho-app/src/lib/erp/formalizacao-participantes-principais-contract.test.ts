import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formulario = readFileSync(
  "src/components/erp/contratacoes/formalizacao-venda-form.tsx",
  "utf8",
);
const pagina = readFileSync("src/app/erp/contratacoes/[id]/page.tsx", "utf8");

describe("formalização — participante comercial principal", () => {
  it("não restringe o principal por nome legado do papel", () => {
    expect(formulario).toContain("Boolean(vinculo.perfil_id && vinculo.perfil)");
    expect(pagina).toContain("Boolean(vinculo.perfil_id && vinculo.perfil)");
    expect(formulario).not.toContain(
      '["CONSULTOR", "GESTOR", "MICROFRANQUIA"].includes(vinculo.papel_tipo.toUpperCase())',
    );
  });

  it("mantém o perfil homologado como fonte da elegibilidade e do percentual", () => {
    expect(formulario).toContain("perfisPrincipalElegiveis");
    expect(formulario).toContain("programaComissaoCompativelComTipoBem");
    expect(formulario).toContain("regraFranquia.programa_id === regraParticipante.programa_id");
  });
});
