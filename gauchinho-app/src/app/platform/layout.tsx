import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createClient } from "@/lib/supabase/server";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformThemeToggle } from "@/components/platform/platform-theme-toggle";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const superadmin = await isPlatformSuperadmin();
  const db = await createClient();
  const { data: reviewer } = superadmin ? { data: false } : await db.rpc("is_platform_technical_reviewer");
  if (!superadmin && !reviewer) redirect("/login?next=/platform");
  const usuario = await getUsuarioNegocio();
  return <div className="flex min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100"><PlatformSidebar restricted={!superadmin}/><div className="min-w-0 flex-1"><header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900"><div><p className="text-xs text-slate-500">Contexto global</p><p className="font-semibold">PLATFORM</p></div><div className="flex items-center gap-3"><span className="text-sm text-slate-500">{usuario?.nome ?? "Operador"}</span><PlatformThemeToggle/></div></header><main className="p-6 lg:p-8">{children}</main></div></div>;
}
