import { PublicHeader } from "@/components/public/public-header";
import { LenisProvider } from "@/components/public/lenis-provider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LenisProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <PublicHeader />
        {children}
      </div>
    </LenisProvider>
  );
}
