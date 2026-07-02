import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { LenisProvider } from "@/components/public/lenis-provider";
import { IaChatWidget } from "@/components/public/ia-chat/ia-chat-widget";
import { getIaConfigPublic } from "@/server/config";
import { loadFooterPartners } from "@/lib/footer/load-footer-partners";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [iaConfig, footerPartners] = await Promise.all([getIaConfigPublic(), loadFooterPartners()]);

  return (
    <LenisProvider>
      <div className="min-h-screen text-zinc-100" style={{ background: "var(--brand-blue)" }}>
        <PublicHeader />
        {children}
        <PublicFooter partners={footerPartners} />
        <IaChatWidget config={iaConfig} />
      </div>
    </LenisProvider>
  );
}
