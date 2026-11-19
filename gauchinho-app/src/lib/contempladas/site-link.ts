import { normalizeHost } from "@/lib/tenant/dominio";
import type { RaconTemplateMenu } from "@/components/public/templates/racon-inspired-home";

/** Portal de cotas contempladas: domínio principal novo; o endereço antigo segue funcionando. */
export const CONTEMPLADAS_URL = "https://contempladasracon.com.br";

/** Sites que mostram o menu e o atalho do portal de contempladas. */
export function siteMostraContempladas(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost).replace(/^www\./, "");
  return host === "raconsinop.com.br" || host.endsWith(".raconsinop.com.br");
}

/** Acrescenta "Contempladas" antes do último item do menu, se ainda não existir. */
export function comMenuContempladas(menus: RaconTemplateMenu[]): RaconTemplateMenu[] {
  if (!menus.length || menus.some((m) => m.rota.startsWith("/contempladas") || m.id === "contempladas")) return menus;
  const item: RaconTemplateMenu = { id: "contempladas", label: "Contempladas", rota: "/contempladas", ativo: true };
  const pos = Math.max(0, menus.length - 1);
  return [...menus.slice(0, pos), item, ...menus.slice(pos)];
}

const FORA_DO_MENU = ["/indicar", "/app-indicador"];

/** Menu do site raconsinop: sem Programa de Indicação e Área do Parceiro; com Eventos e Contempladas. */
export function menuSiteRaconSinop(menus: RaconTemplateMenu[]): RaconTemplateMenu[] {
  if (!menus.length) return menus;
  let lista = menus.filter((m) => !FORA_DO_MENU.some((r) => m.rota.startsWith(r)));
  if (!lista.some((m) => m.rota.startsWith("/eventos"))) {
    const pos = Math.max(0, lista.length - 1);
    lista = [...lista.slice(0, pos), { id: "eventos", label: "Eventos", rota: "/eventos", ativo: true }, ...lista.slice(pos)];
  }
  return comMenuContempladas(lista);
}
