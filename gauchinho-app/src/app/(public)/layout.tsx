import { PublicHeader } from "@/components/public/public-header";
import { LenisProvider } from "@/components/public/lenis-provider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LenisProvider>
      <div className="min-h-screen text-zinc-100" style={{ background: "var(--brand-blue)" }}>
        <PublicHeader />
        {children}
      </div>
    </LenisProvider>
  );
}
