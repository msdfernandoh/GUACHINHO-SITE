import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";

export type ImovelWhatsappContext = {
  imovelWhatsapp?: string | null;
  usarWhatsappImobiliaria?: boolean;
  imobiliariaWhatsapp?: string | null;
};

export type WhatsappDestino = {
  numero: string;
  mensagem: string;
  origemResolvida: "imovel" | "imobiliaria" | "origem_config" | "principal" | "none";
};

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

export function buildImovelInteresseMensagem(nome: string, imovelTitulo: string): string {
  return `Olá, vi o imóvel ${imovelTitulo} no site Gauchinho Escritório de Soluções Financeiras. Meu nome é ${nome} e gostaria de mais informações.`;
}

/**
 * Prioridade: imóvel → imobiliária → origem oportunidade_imobiliaria → principal Gauchinho.
 */
export async function resolveWhatsappImovelInteresse(
  ctx: ImovelWhatsappContext,
  nomeCliente: string,
  imovelTitulo: string,
): Promise<WhatsappDestino | null> {
  const mensagem = buildImovelInteresseMensagem(nomeCliente, imovelTitulo);

  const imovelWa = ctx.imovelWhatsapp?.trim();
  if (imovelWa) {
    const n = digitsOnly(imovelWa);
    if (n.length >= 10) {
      return { numero: n, mensagem, origemResolvida: "imovel" };
    }
  }

  if (ctx.usarWhatsappImobiliaria !== false) {
    const imobWa = ctx.imobiliariaWhatsapp?.trim();
    if (imobWa) {
      const n = digitsOnly(imobWa);
      if (n.length >= 10) {
        return { numero: n, mensagem, origemResolvida: "imobiliaria" };
      }
    }
  }

  const origem = await resolveWhatsappOrigem("oportunidade_imobiliaria");
  if (origem?.whatsapp_destino?.trim()) {
    const n = digitsOnly(origem.whatsapp_destino);
    if (n.length >= 10) {
      return { numero: n, mensagem, origemResolvida: "origem_config" };
    }
  }

  const contato = await getConfigJsonPublic("contato", DEFAULT_CONTATO);
  const principal = contato.whatsappPrincipal?.trim();
  if (principal) {
    const n = digitsOnly(principal);
    if (n.length >= 10) {
      return { numero: n, mensagem, origemResolvida: "principal" };
    }
  }

  return null;
}

export function whatsappUrl(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
