import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  diagnosticarDnsEmpresaDominio,
  verificarHttpsEmpresaDominio,
} from "@/lib/platform/empresa-dominio-dns.server";
import {
  getDefaultVercelDomainsClient,
  hasVercelDomainsApiCredentials,
  dnsRegistrosPreferenciaisFromVercelConfig,
} from "@/lib/parceiros/vercel-domains.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: dominios, error } = await admin
    .from("empresa_dominios")
    .select("id,empresa_id,valor,tipo,status_vercel")
    .eq("ativo", true)
    .eq("verificado", false)
    .order("ultima_verificacao_em", { ascending: true, nullsFirst: true })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const client = hasVercelDomainsApiCredentials() ? getDefaultVercelDomainsClient() : null;
  const resultados = await Promise.allSettled((dominios ?? []).map(async (dominio) => {
    let statusVercel = dominio.status_vercel || "PENDENTE";
    let vercelErro: string | null = null;
    let registrosRecomendados: Array<{ tipo: string; host: string; valor: string }> | null = null;
    if (client) {
      const add = await client.addDomain(dominio.valor);
      if (add.ok) {
        statusVercel = "ADICIONADO";
        const config = await client.getDomainConfig(dominio.valor);
        if (config.ok) {
          const isSubdominio = dominio.tipo === "SUBDOMINIO" || dominio.valor.split(".").length > 2;
          registrosRecomendados = dnsRegistrosPreferenciaisFromVercelConfig(
            config.data,
            dominio.valor,
            isSubdominio,
          );
        }
      }
      else {
        statusVercel = "ERRO";
        vercelErro = add.error;
      }
    }

    const dns = await diagnosticarDnsEmpresaDominio(dominio.valor, dominio.tipo, registrosRecomendados);
    const sslReady = dns.verificado ? await verificarHttpsEmpresaDominio(dominio.valor) : false;
    const verificado = dns.verificado && sslReady;
    if (sslReady) statusVercel = "ADICIONADO";
    const mensagem = vercelErro ?? (!dns.verificado
      ? dns.mensagem
      : !sslReady
        ? "DNS propagado; aguardando certificado HTTPS."
        : null);

    const { error: updateError } = await admin
      .from("empresa_dominios")
      .update({
        verificado,
        status_dns: dns.status,
        status_vercel: statusVercel,
        status_ssl: sslReady ? "READY" : "PENDING",
        dns_instrucoes: {
          registros_esperados: dns.registros_esperados,
          registros_encontrados: dns.registros_encontrados,
        },
        ultima_verificacao_em: new Date().toISOString(),
        ultima_mensagem_erro: mensagem,
      })
      .eq("id", dominio.id);
    if (updateError) throw updateError;
    return { id: dominio.id, verificado, dns: dns.status, ssl: sslReady };
  }));

  return NextResponse.json({
    processados: resultados.length,
    concluidos: resultados.filter((r) => r.status === "fulfilled" && r.value.verificado).length,
    falhas: resultados.filter((r) => r.status === "rejected").length,
  });
}
