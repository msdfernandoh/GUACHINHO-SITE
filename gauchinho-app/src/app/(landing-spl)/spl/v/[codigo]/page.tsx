import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { listarEmpreendimentos, vendedorPorCodigo } from "@/lib/spl/repo";
import { getSplConfig } from "@/lib/spl/config-server";
import { vendedorVeComissao } from "@/lib/spl/types";
import { acharGrupoPorCodigo } from "@/lib/spl/combinacao-cartas";
import { caminhoPortfolio } from "@/lib/spl/links";
import { metadataAppSpl } from "@/lib/spl/app-metadata";
import { fetchPublicGruposAggregatesForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { fetchPublicCartasAutorizadasForEmpresa } from "@/lib/cartas/catalogo-autorizado-cartas";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";
import { SplPortfolio, type CartaPortfolio, type PlanoPortfolio } from "@/components/spl/spl-portfolio";
import { SplShell } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const tenant = await getResolvedTenant();
  const acesso = tenant ? await vendedorPorCodigo(tenant.empresaId, codigo) : null;
  return metadataAppSpl({
    titulo: acesso ? `Portfólio SPL · ${acesso.vendedor.nome}` : "Portfólio SPL",
    inicio: acesso ? caminhoPortfolio(acesso.imobiliaria.nome, acesso.vendedor.codigo) : "/spl",
    nomeApp: acesso ? `Portfólio SPL · ${acesso.imobiliaria.nome}` : "Portfólio SPL",
    curto: "Portfólio SPL",
  });
}

export default async function SplPortfolioPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const acesso = await vendedorPorCodigo(tenant.empresaId, codigo);
  if (!acesso) notFound();
  const { vendedor, imobiliaria } = acesso;

  const [config, empreendimentos, aggs, cartasRaw, contato] = await Promise.all([
    getSplConfig(),
    listarEmpreendimentos(tenant.empresaId),
    fetchPublicGruposAggregatesForEmpresa(tenant.empresaId).catch(() => []),
    fetchPublicCartasAutorizadasForEmpresa(tenant.empresaId).catch(() => []),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  const planos: PlanoPortfolio[] = [
    {
      chave: "CONSORCIO_SPL",
      nome: "Plano SPL",
      codigo: config.grupoSpl,
      reduzida: config.reduzidaSpl,
      embutido: config.embutidoSpl,
      reajuste: config.reajusteSpl,
      agg: acharGrupoPorCodigo(aggs, config.grupoSpl),
    },
    {
      chave: "CONSORCIO_ECONOMICO",
      nome: "Plano Econômico",
      codigo: config.grupoEconomico,
      reduzida: config.reduzidaEconomico,
      embutido: config.embutidoEconomico,
      reajuste: config.reajusteEconomico,
      agg: acharGrupoPorCodigo(aggs, config.grupoEconomico),
    },
  ];

  // Cartas de imóvel ativas no site hoje (disponíveis ou a consultar).
  const cartas: CartaPortfolio[] = cartasRaw
    .filter((c) => c.ativo !== false && c.tipo_carta === "imovel" && Number(c.credito) > 0)
    .map((c) => ({
      id: c.id,
      credito: Number(c.credito),
      entrada: c.entrada != null ? Number(c.entrada) : null,
      prazo: c.prazo_quantidade ?? null,
      parcela: c.valor_parcela != null ? Number(c.valor_parcela) : null,
      saldo: c.saldo_devedor != null ? Number(c.saldo_devedor) : null,
      transferencia: c.taxa_transferencia != null ? Number(c.taxa_transferencia) : null,
      vencimento: c.proxima_parcela_data ?? null,
    }));

  const whatsappReservas =
    config.whatsappReservas || String((contato as { whatsappPrincipal?: string }).whatsappPrincipal ?? "").replace(/\D/g, "");

  return (
    <SplShell>
      <SplPortfolio
        vendedor={{ codigo: vendedor.codigo, nome: vendedor.nome, modelo: vendedor.modelo }}
        imobiliaria={{ nome: imobiliaria.nome, logo_url: imobiliaria.logo_url }}
        veComissao={vendedorVeComissao(vendedor.modelo)}
        empreendimentos={empreendimentos}
        planos={planos}
        cartas={cartas}
        taxas={{
          financiamento: config.taxaFinanciamentoMensal,
          prazoFinanciamento: config.prazoFinanciamentoMeses,
          homeEquity: config.taxaHomeEquityMensal,
          prazoHomeEquity: config.prazoHomeEquityMeses,
        }}
        whatsappReservas={whatsappReservas}
        validadeHoras={config.validadePropostaHoras}
      />
    </SplShell>
  );
}
