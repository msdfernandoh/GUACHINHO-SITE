import Link from "next/link";
import { AuthMascotBubble } from "@/components/public/auth-mascot-bubble";
import { PublicLogo } from "@/components/public/public-logo";
import { resolvePublicLogoText } from "@/lib/brand/public-logo-text";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  const { title, subtitle } = resolvePublicLogoText(site.nomeEmpresa, site.subtitulo);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex justify-center px-4 pt-6 sm:pt-8">
        <PublicLogo href="/" logoUrl={site.logoUrl} title={title} subtitle={subtitle} />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <AuthMascotBubble />
      <p className="pb-6 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-amber-500">
          ← Voltar para o site
        </Link>
      </p>
    </div>
  );
}
