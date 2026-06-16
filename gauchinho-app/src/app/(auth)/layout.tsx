import Link from "next/link";
import { PublicLogo } from "@/components/public/public-logo";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="flex justify-center px-4 pt-6 sm:pt-8">
        <PublicLogo
          href="/"
          logoUrl={site.logoUrl}
          title={site.nomeEmpresa?.trim() || "GAUCHINHO"}
          subtitle={site.subtitulo?.trim() || "Escritório de Soluções Financeiras"}
        />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <p className="pb-6 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-amber-500">
          ← Voltar para o site
        </Link>
      </p>
    </div>
  );
}
