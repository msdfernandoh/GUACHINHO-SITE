import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { FASE3_PARCEIRO_AREA_ENABLED } from "@/lib/parceiros/constants";
import { fase3ParceiroAreaDisabledMessage } from "@/lib/parceiros/schema-ready";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import Image from "next/image";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Área do Parceiro",
};

export default async function AreaParceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!FASE3_PARCEIRO_AREA_ENABLED) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 px-6 text-stone-800">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold">Área do parceiro indisponível</p>
          <p className="mt-2 text-sm text-stone-600">{fase3ParceiroAreaDisabledMessage()}</p>
          <Link href="/" className="mt-6 inline-block text-sm underline">
            Voltar ao site
          </Link>
        </div>
      </div>
    );
  }

  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    redirect("/login?next=/area-parceiro");
  }
  const tenant = await getResolvedTenant();
  const nomeEmpresa = tenant?.branding.nome_site || "Área comercial";
  const logoUrl = tenant?.branding.logo_url || tenant?.siteModel?.logoPadraoUrl || null;
  const primary = tenant?.branding.cor_primaria || "#0066cc";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            {logoUrl ? <div className="relative h-9 w-36"><Image src={logoUrl} alt={nomeEmpresa} fill className="object-contain object-left" /></div> : null}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{nomeEmpresa}</p>
              <p className="text-lg font-semibold">Área do Parceiro</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-medium" style={{ color: primary }}>
            <Link href="/area-parceiro" className="hover:underline">
              Início
            </Link>
            <Link href="/area-parceiro/leads" className="hover:underline">
              Leads
            </Link>
            <Link href="/area-parceiro/propostas" className="hover:underline">
              Propostas
            </Link>
          </nav>
          <p className="text-sm text-slate-600">{usuario.nome}</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
