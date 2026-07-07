import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { LenisProvider } from "@/components/public/lenis-provider";
import { IaChatWidget } from "@/components/public/ia-chat/ia-chat-widget";
import { PublicJsonLd } from "@/components/public/seo/public-json-ld";
import { getIaConfigPublic } from "@/server/config";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const iaConfig = await getIaConfigPublic();

  return (
    <LenisProvider>
      <PublicJsonLd />
      <div className="min-h-screen text-zinc-100" style={{ background: "var(--brand-blue)" }}>
        <PublicHeader />
        {children}
        <PublicFooter />
        <IaChatWidget config={iaConfig} />
      </div>
    </LenisProvider>
  );
}
