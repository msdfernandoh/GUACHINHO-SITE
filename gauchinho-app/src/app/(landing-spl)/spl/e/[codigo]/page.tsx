import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { imobiliariaPorConvite } from "@/lib/spl/repo";
import { modeloDoConvite } from "@/lib/spl/convite";
import { modeloPadraoVendedor } from "@/lib/spl/types";
import { SplVendedorCadastro } from "@/components/spl/spl-vendedor-cadastro";
import { SplShell } from "@/components/spl/spl-ui";
import { getTermoVendedorSpl } from "@/lib/spl/termos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Cadastro de vendedor · Portfólio SPL" }, robots: { index: false } };

export default async function SplConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ m?: string; s?: string }>;
}) {
  const [{ codigo }, { m, s }] = await Promise.all([params, searchParams]);
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const imob = await imobiliariaPorConvite(tenant.empresaId, codigo);
  if (!imob) notFound();
  const doLink = modeloDoConvite(imob.token_painel, imob.codigo_convite, m, s);
  const modelo = doLink ?? modeloPadraoVendedor(imob.modelo_vendedores);
  const termo = modelo === "PROPRIO" ? null : await getTermoVendedorSpl(tenant.empresaId);
  return (
    <SplShell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <SplVendedorCadastro
          convite={imob.codigo_convite}
          imobiliaria={imob.nome}
          modelo={modelo}
          termo={termo}
          assinatura={doLink ? { m: String(m), s: String(s) } : null}
        />
      </main>
    </SplShell>
  );
}
