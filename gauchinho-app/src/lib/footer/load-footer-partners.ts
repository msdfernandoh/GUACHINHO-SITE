"use server";

import { fetchPublicParceiros } from "@/lib/conteudo/fetch-public";
import { fetchPublicImobiliariasParceiras } from "@/app/admin/imobiliarias/actions";
import { fetchPublicSeguradoras } from "@/app/admin/seguradoras/actions";
import { safeFetch } from "@/lib/home/safe-fetch";

export type FooterPartnerLogo = {
  id: string;
  nome: string;
  logoUrl: string | null;
  href: string | null;
};

export async function loadFooterPartners(): Promise<FooterPartnerLogo[]> {
  const [parceiros, imobs, segs] = await Promise.all([
    safeFetch(() => fetchPublicParceiros(), []),
    safeFetch(() => fetchPublicImobiliariasParceiras(), []),
    safeFetch(() => fetchPublicSeguradoras(), []),
  ]);

  const items: FooterPartnerLogo[] = [];

  for (const p of parceiros) {
    items.push({
      id: `p-${p.id}`,
      nome: p.nome,
      logoUrl: p.logo_url,
      href: p.site_url,
    });
  }
  for (const i of imobs) {
    if (!i.ativo) continue;
    items.push({
      id: `i-${i.id}`,
      nome: i.nome,
      logoUrl: i.logo_url,
      href: i.site ?? null,
    });
  }
  for (const s of segs) {
    items.push({
      id: `s-${s.id}`,
      nome: s.nome,
      logoUrl: s.logo_url,
      href: s.site_url,
    });
  }

  return items.filter((x) => x.nome.trim().length > 0);
}
